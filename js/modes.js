/* modes.js — single source of mode behaviour: action buttons, decision logic
   (correct), chart category mapping (cell / cellCat / catName) and labels. */
/* ============ MODES · 单一来源的模式配置 ============
   每个决策模式集中定义：动作按钮(actions)、答案显示名(names)、训练判定(correct)、
   图表格子分类(cell)、图例(legend)、分类显示名覆盖(catName)。
   新增或修改一个模式，只改这一处 —— 训练页、反馈、图表会自动跟随。
   correct(isR,isC,isM) → 正确动作集合（数组；长度>1 即混合点）
   cell(isR,isC,isM)    → 矩阵格子 css 分类
   边缘混合带(isM)的“该打动作”已内嵌进 correct/cell，不再单独维护 EDGE_PLAY 表。 */
const ACT_LABEL={fold:['弃牌','FOLD','a-fold'],call:['跟注','CALL','a-call'],
 raise:['加注开局','RAISE','a-raise'],raise3:['反加 3-bet','3-BET','a-3bet'],
 raise4:['再加 4-bet','4-BET','a-3bet'],squeeze:['挤压 3-bet','SQUEEZE','a-3bet'],
 shove5:['5-bet 全下','5-BET ALLIN','a-raise'],
 shove:['全下','ALL IN','a-raise'],callshove:['跟注全下','CALL','a-call']};
const CAT_NAME={raise:'加注',shove:'全下',threebet:'3-bet',call:'跟注',mix:'3-bet / 跟注（混合）',
 'edge-raise':'加注 / 弃牌（边缘混合）','edge-shove':'全下 / 弃牌（边缘混合）','edge-call':'跟注 / 弃牌（边缘混合）',fold:'弃牌'};
/* 复用的判定 / 格子函数（按模式语义命名，供下方 MODES 引用） */
const CORRECT={
 raiseFold:(isR,isC,isM)=>isR?['raise']:isM?['raise','fold']:['fold'],
 shoveFold:(isR,isC,isM)=>isR?['shove']:isM?['shove','fold']:['fold'],
 callFold :(isR,isC,isM)=>isC?['call'] :isM?['call','fold'] :['fold'],
 raiseCall:(isR,isC,isM)=>(isR&&isC)?['raise','call']:isR?['raise']:isC?['call']:isM?['call','fold']:['fold'],
 shoveCall:(isR,isC,isM)=>(isR&&isC)?['shove','call']:isR?['shove']:isC?['call']:isM?['call','fold']:['fold'],
};
const CELL={
 raiseFold:(isR,isC,isM)=>isR?'raise':isM?'edge-raise':'fold',
 shoveFold:(isR,isC,isM)=>isR?'shove':isM?'edge-shove':'fold',
 callFold :(isR,isC,isM)=>isC?'call' :isM?'edge-call':'fold',
 raiseCall:(isR,isC,isM)=>(isR&&isC)?'mix'   :isR?'threebet':isC?'call':isM?'edge-call':'fold',
 shoveCall:(isR,isC,isM)=>(isR&&isC)?'mixjam':isR?'shove'   :isC?'call':isM?'edge-call':'fold',
};
const MODES={
 open:{actions:[['fold',ACT_LABEL.fold],['raise',ACT_LABEL.raise]],
  names:{fold:'弃牌',raise:'加注'},correct:CORRECT.raiseFold,cell:CELL.raiseFold,
  legend:[['raise','加注'],['edge-raise','边缘'],['fold','弃牌']]},
 push:{actions:[['fold',ACT_LABEL.fold],['shove',ACT_LABEL.shove]],
  names:{fold:'弃牌',shove:'全下'},correct:CORRECT.shoveFold,cell:CELL.shoveFold,
  legend:[['shove','全下'],['edge-shove','边缘'],['fold','弃牌']]},
 callshove:{actions:[['fold',ACT_LABEL.fold],['call',ACT_LABEL.callshove]],
  names:{fold:'弃牌',call:'跟注全下'},correct:CORRECT.callFold,cell:CELL.callFold,
  legend:[['call','跟注全下'],['edge-call','边缘'],['fold','弃牌']]},
 defense:{actions:[['fold',ACT_LABEL.fold],['call',ACT_LABEL.call],['raise',ACT_LABEL.raise3]],
  names:{fold:'弃牌',call:'跟注',raise:'3-bet'},correct:CORRECT.raiseCall,cell:CELL.raiseCall,
  legend:[['threebet','3-bet'],['call','跟注'],['mix','混合'],['edge-call','边缘'],['fold','弃牌']]},
 face3b:{actions:[['fold',ACT_LABEL.fold],['call',ACT_LABEL.call],['raise',ACT_LABEL.raise4]],
  names:{fold:'弃牌',call:'跟注',raise:'4-bet'},correct:CORRECT.raiseCall,cell:CELL.raiseCall,
  catName:{threebet:'4-bet',mix:'4-bet / 跟注（混合）'},
  legend:[['threebet','4-bet'],['call','跟注'],['mix','混合'],['edge-call','边缘'],['fold','弃牌']]},
 squeeze:{actions:[['fold',ACT_LABEL.fold],['call',ACT_LABEL.call],['raise',ACT_LABEL.squeeze]],
  names:{fold:'弃牌',call:'跟注',raise:'挤压'},correct:CORRECT.raiseCall,cell:CELL.raiseCall,
  catName:{threebet:'挤压 3-bet',mix:'挤压 / 跟注（混合）'},
  legend:[['threebet','挤压'],['call','跟注'],['mix','混合'],['edge-call','边缘'],['fold','弃牌']]},
 face4b:{actions:[['fold',ACT_LABEL.fold],['call',ACT_LABEL.call],['shove',ACT_LABEL.shove5]],
  names:{fold:'弃牌',call:'跟注',shove:'5-bet 全下'},correct:CORRECT.shoveCall,cell:CELL.shoveCall,
  catName:{shove:'5-bet 全下',mixjam:'5-bet全下 / 跟注（混合）'},
  legend:[['shove','5-bet 全下'],['call','跟注'],['fold','弃牌']]},
};

/* 图表分类 / 名称 / 图例 全部读取顶部 MODES（CAT_NAME 为基础名，catName 处理模式覆盖） */
function cellCat(t,hand){
 const isR=t.R.has(hand),isC=t.C.has(hand),isM=t.M.has(hand);
 return MODES[t.mode].cell(isR,isC,isM);
}
function catName(cat,mode){
 const o=MODES[mode].catName;
 return (o&&o[cat])||CAT_NAME[cat];
}

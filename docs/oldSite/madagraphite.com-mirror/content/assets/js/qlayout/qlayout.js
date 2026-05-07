// 扩展mui提示框
/*
icon:
cancel 取消操作
forbidden 禁止操作
success 成功
text 纯文本
loading 加载
*/
var mylayout = new Object();
    mylayout.toast

    mylayout.closeToast = function(){
      $(".toast-mask").remove();
      $(".toast-container").remove();
    }


// 构造方法
function Qlayout(){
  // 打开提示框
  this.toast = function(msg, obj='' , callback = ''){
    if(obj !== ''){
      if(obj.time === undefined){
        obj.time = 2000;
      }
      if(obj.icon === undefined){
        obj.icon = 'text';
      }
    }else{
      obj = {time:2000,icon:'text'};
    }
    $("body").append('<div class="toast-mask"></div><div class="toast-container"><div class="toast-message"><i class="'+obj.icon+'"></i><p>'+msg+'</p></div></div>');
    setTimeout(function(){
      if( typeof(callback) == 'function'){
        callback();
      }
      Q.closeToast();
    },obj.time)
  };
  // 关闭提示框
  this.closeToast = function(){
    $(".toast-mask").remove();
    $(".toast-container").remove();
  }

}
// 实例化
var Q = new Qlayout();

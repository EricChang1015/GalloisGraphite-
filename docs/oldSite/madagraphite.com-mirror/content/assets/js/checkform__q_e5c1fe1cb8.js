$(document).ready(function(){

  // 下拉选择框
  $(".selected").on("click",function(event){
    var option = $(this).parent().find(".select-option");
    if(option.hasClass("active")){
      option.removeClass("active");
    }else{
      option.addClass("active");
    }
    event.stopPropagation();    //  阻止事件冒泡
  });

  // 选中下拉
  $(".select-option").on("click",'a',function(event){
    var selectVal = $(this).attr("data-val");
    $(this).parent().parent().parent().removeClass("active");

    $(this).parent().parent().parent().parent().find('.hidden-value').val( selectVal );
    $(this).parent().parent().parent().parent().find('.selected').html( selectVal );

    $(this).parent().parent().find('a').removeClass("active");
    $(this).addClass("active");
    event.stopPropagation();    //  阻止事件冒泡
  });


  $("body").click(function(event){
    $(".select-option").removeClass("active");
  });

           
  // 提交时验证表单
  $("#myform").validate({
    highlight: function(element) {
      $(element).closest('.form-group').removeClass('has-success').addClass('has-error');
    },
    success: function(element) {
      $(element).closest('.form-group').removeClass('has-error').addClass('has-success');
    },
    rules: {
      email: {
        email: true
      },
      area: {
        required: true,
        rangelength:[1,4] 
      },
      phone: {
        required: true,
        digits:true,
        rangelength:[8,11] 
      },
      message:{
        minlength:5
      }
    },
    submitHandler: function() {
      var services = $("select[name='services']").val(),
          name = $("input[name='name']").val(),
          email = $("input[name='email']").val(),
          area = $("input[name='area']").val(),
          phone = $("input[name='phone']").val(),
          message = $("textarea[name='message']").val(),
          token = $("input[name='token']").val();

      var data = {services:services, name:name, email:email, area:area, phone:phone, message:message, token:token};

      // ajax submit
      Q.toast("Loading",{"icon":"loading",time:3600000});
      var callback = function(res){
        Q.closeToast();
        if(res.status == 1){
          Q.toast(res.msg,{icon:'success',time:2000},function(){
            $('#myform')[0].reset();
          });
        }else{
          Q.toast(res.msg,{icon:'forbidden',time:2000});
        }
      }
      ajax_post(__SUBMITURL__, data, callback);
      return false;
    }
  });
})
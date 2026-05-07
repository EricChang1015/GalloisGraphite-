var isMobile;
$(document).ready(function(){
  
  $("#loader").fadeOut();
  $("body").css({'overflow':'visible'});

  $("#languageBtn").on('click',function(){
    if( $(this).parent().hasClass('active') ){
      $(this).parent().removeClass('active');
    }else{
      $(this).parent().addClass('active');
    }
  })

  $(".showmorebtn").on('click', function(){
    if( $(this).parent().hasClass('active') ){
        $(this).parent().removeClass('active');
    }else{
        $(this).parent().addClass('active');
    }
  })

  $(".menu-open").on('click', function(){
    if( $(this).parent().hasClass('show') ){
        $(this).parent().removeClass('show');
    }else{
        $(this).parent().addClass('show');
    }
  })

  // toTOP
  $('#roll_top').click(function () {
    $('html,body').animate({
      scrollTop : '0px'
    }, 300);
  });

  /*返回顶部*/
  $(window).scroll(function () {
    if ($(window).scrollTop() > 100) {
      $('#roll_top').fadeIn(500);
    } else {
      $('#roll_top').fadeOut(500);
    }
    
  });

  is_mobile();
});

$(window).resize(function(){
  is_mobile();
});


$(window).load(function(){
  //$("#loader").fadeOut();
  //$("body").css({'overflow':'visible'});
})

// is mobile
function is_mobile(){
  var bodyW = $("body").width();
  if(bodyW <= 640){
    isMobile = true;
  }else{
    isMobile = false;
  }
  console.log(isMobile);
}


// AJAX POST
function ajax_post(url,obj,callback){
  $.ajax({
    url: url,
    cache: false,
    data: obj,
    type: "POST",
    dataType: "json",
    success: function(data){
      callback(data);
    },
    error:function (XMLHttpRequest, textStatus, errorThrown) {
      console.log(XMLHttpRequest);
      console.log(textStatus);
      console.log(errorThrown);
    }
  });
}


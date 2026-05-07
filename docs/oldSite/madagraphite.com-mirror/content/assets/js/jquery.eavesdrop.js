var barHeight = 0;
$(function () {
	if( isMobile == true){
		barHeight = 60;
	}
	var nav = $("#nav");
	var mainPage = $(".mainPage");
	var mainTopArr = new Array();
	for(var i=0;i<mainPage.length;i++){
			var top = mainPage.eq(i).offset().top - barHeight;
			mainTopArr.push(top);
	}
	$(window).scroll(function(){
			var scrollTop = $(this).scrollTop();
			var k;
			for(var i=0;i<mainTopArr.length;i++){
					if(scrollTop>=mainTopArr[i]){
							k=i;
					}
			}
			nav.find("li").eq(k).addClass("active").siblings().removeClass("active");
	});
	nav.find("a[href^='#']").click(function(e){
			if( isMobile == true ){
				$(".top .wrapper").removeClass('show');
			}
			e.preventDefault();
			$('html, body').animate({scrollTop: ($(this.hash).offset().top) - (barHeight - 1) }, 300);
	});

});

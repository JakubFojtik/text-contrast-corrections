// ==UserScript==
// @name          Text contrast corrections
// @namespace     http://userstyles.org
// @description	  Sets minimum font width to normal and increases contrast between text and background if necessary.
// @author        Jakub Fojtík
// @include       *
// @version       1
// ==/UserScript==

//Todo:
//Rerun for lazy-loaded content e.g. comments on gog.com
//Save intermediate results for speed

(function() {
  
  function elementsUnder(el){
    var n, a=[], walk=document.createTreeWalker(el,NodeFilter.SHOW_ELEMENT,null,false);
    while(n=walk.nextNode()) a.push(n);
    return a;
  }
  
  function isColTransparent(parts){
    return parts.length==4 && parts[3]==0;
  }
  
  function isColOpaque(parts){
    return parts.length<4 || parts[3]==255;
  }
  
  function colorParts(element, prop){
    var regex = /[0-9]+/g;
    var col = window.getComputedStyle(element).getPropertyValue(prop);
    var parts = col.match(regex);
    
    if(isColTransparent(parts)) {	//Background color can not be computed, if not directly set returns rgba(0,0,0,0)
      let bgcolor = 'rgb(255, 255, 255)';	//default bg color if all elements report transparent
      while(element.parentNode!=null) {
        element = element.parentNode;
        col = window.getComputedStyle(element).getPropertyValue(prop);	//Is getComputedStyle inspecting also parent elements for non-computable bgcolor? If yes, optimize?
        parts = col.match(regex);
        if(isColOpaque(parts)) {	//Only accepts fully opaque color, partialy transparent colors are ignored. Todo compute them into the resulting color.
          bgcolor = col;
          break;
        }
      }
      parts = bgcolor.match(regex);
      
      //Todo create global dictionary of elemt->bgcolor for later lookup. Also assign computed bgcolor to elements between the current and the colored.
      //So that  Blue->transp->transp->transp becomes not only Blue->transp->transp->Blue,
      //but also Blue->Blue->  Blue->  Blue
      
    	/*
      //Stub for applying partial transparency to the color parts.
      //To make background "more transparent" means making it more of the opaque color it has - if it is bright then brighten, else darken.
      if(!isColOpaque(parts)) {
        parts.forEach(function(part, idx, arr) {
          arr[idx] = Math.round(Math.max(0,part*(255-arr[3])/255));	//todo alter for darkening, maybe compute intermediate colors
        });
      }
      */
    }
    
    return parts;
  }
  
  function colorLum(parts){
    return parts.reduce((a,b)=>parseInt(a)+parseInt(b),0)/3;
  }
  
  function changeLum(parts, brighten){
    var fun = brighten ? Math.min : Math.max;
    var limit = brighten ? 255 : 0;
    var op = brighten ? (a,b)=>a+b : (a,b)=>a-b;
    return parts.forEach(function(part, idx, arr) {
        arr[idx] = fun(limit, op(part,80));
      });
  }
  
  //todo change to side-effect-only function, do not return color
  function correct(element, prop, parts, brighten){
    //If color is extreme enough it is ok, otherwise make it more extreme (whiter or blacker).
    var isSaturatedEnough = brighten ? (a,b)=>a>b : (a,b)=>a<b;
    var saturationLimit = brighten ? 192 : 64;
    var colorOk = false;
    //If at least one color part is dark then the color is dark - #f0f is purple.
    //But #ff0 is yellow, todo improve algorithm
    parts.forEach(function(part) {
      if(isSaturatedEnough(part,saturationLimit)) colorOk = true;
    });
    if(!colorOk) {
      changeLum(parts, brighten);
      element.style.setProperty(prop, 'rgb('+parts.join(',')+')', "important");
    }
    return parts;
  }
  
  
  elementsUnder(document.body).forEach(function(element) {
    //if(element.className!='productcard-basics__title') return;
    let fw = window.getComputedStyle(element).getPropertyValue('font-weight');
    if(fw<400) element.style.setProperty("font-weight", 400, "important");
    
		var colParts = colorParts(element, 'color');
		var bgcParts = colorParts(element, 'background-color');
    //alert(colParts + ', ' + bgcParts);
    let isColBrighter = colorLum(colParts) > colorLum(bgcParts);
    colParts = correct(element, "color", colParts, isColBrighter);
		bgcParts = correct(element, "background-color", bgcParts, !isColBrighter);
    //alert(colParts + ', ' + bgcParts);
    
    
  });
})();

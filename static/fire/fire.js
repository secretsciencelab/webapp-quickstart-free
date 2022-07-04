/* https://codepen.io/MarioDesigns/pen/mRwvzN */
// depends on:
// - fire.css
// - jQuery

function Fire(cfg) {
  this.selector = cfg.selector;
  this.init();
}

Fire.prototype.init = function() {
  var f = this;

  $(this.selector).append($("<div/>", {
    class: "cssfire-scene",
    html: 
      "<div class='cssfire-fire'>" +
      "<div class='fire-front'></div>" +
      "<div class='fire-mid'></div>" +
      "<div class='fire-back'></div>" +
  		"<div class='fireplace'><img src='/static/fire/fireplace.svg'/></div>" +
      "</div>"
  }));
  $(this.selector).append($("<div/>", {
    class: "cssfire-background",
  }));
  $(this.selector).append($("<div/>", {
    class: "cssfire-moon",
  }));

  /*
   The javascript aims to create the necessary particles
   and give them dynamic values such as, size and placement
   for the fire effect but all animation are handeled by
   css for an easier control in the behaviour
  */

  //set vars
  f.fireFrontContainer = $(f.selector + " .fire-front");
  f.fireMidContainer = $(f.selector + " .fire-mid");
  f.fireBackContainer = $(f.selector + " .fire-back");

  var NPFireFront = f.rand(10,15);
  var arrayPFireFront = [];
  var NPFireMid = f.rand(80,100);
  var arrayPFireMid = [];
  var NPFireBack = f.rand(100,140);
  var arrayPFireBack = [];

  function FireParticle(type) {
    if ( type === 'front' ) {
      this.radius = f.rand(1, 15);
      this.margin = this.radius / 2;
      this.speed = f.randInt(1, 1.5);	
      this.delay = f.randInt(1, 2);
      this.y = f.randInt(0.5,1);
      this.x = f.randInt(40,60);
    } else if ( type === 'mid' ) {
      this.radius = f.rand(10, 30);
      this.margin = this.radius / 2;
      this.speed = f.randInt(0.2, 0.6);
      this.delay = f.randInt(0.5, 1);
      this.y = f.randInt(0.25,0.5);
      this.x = f.randInt(35,65);
    } else if ( type == 'back' ) {
      this.radius = f.rand(10, 40);
      this.margin = this.radius / 2;
      this.speed = f.randInt(0.6, 0.8);
      this.delay = f.randInt(0, 0.5);
      this.y = f.randInt(0, 0.5);
      this.x = f.randInt(35,65);
    }
    this.html = '<span style="width: '+this.radius+'px; height: '+this.radius+'px; left: '+this.x+'%; bottom: '+this.y+'%; margin-left: -'+this.margin+'px; animation-delay: '+this.delay+'s; animation-speed: '+this.speed+'s"></span>';
  }

  while ( arrayPFireFront.length < NPFireFront ) {
    var fireParticle = new FireParticle('front');
    arrayPFireFront.push(fireParticle);
    f.fireFrontContainer.html(f.fireFrontContainer.html() + fireParticle.html);
  }

  while ( arrayPFireMid.length < NPFireMid ) {
    var fireParticle = new FireParticle('mid');
    arrayPFireMid.push(fireParticle);
    f.fireMidContainer.html(f.fireMidContainer.html() + fireParticle.html);
  }

  while ( arrayPFireBack.length < NPFireBack ) {
    var fireParticle = new FireParticle('back');
    arrayPFireBack.push(fireParticle);
    f.fireBackContainer.html(f.fireBackContainer.html() + fireParticle.html);
  }

  f.stop(); // start stopped 
}

Fire.prototype.rand = function(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

Fire.prototype.randInt = function(min, max) {
  return Math.random() * (max - min) + min;
}

Fire.prototype.start = function() {
  this.fireFrontContainer.show();
  this.fireMidContainer.show();
  this.fireBackContainer.show();
}

Fire.prototype.stop = function() {
  this.fireFrontContainer.hide();
  this.fireMidContainer.hide();
  this.fireBackContainer.hide();
}

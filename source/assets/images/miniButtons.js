(function(window) {
buttons = function() {
	this.initialize();
}
buttons._SpriteSheet = new createjs.SpriteSheet({images: ["miniButtons.png"], frames: [[0,0,127,33,0,66.5,13.05],[127,0,127,33,0,66.5,13.05],[0,33,127,33,0,65.5,13.05],[127,33,127,33,0,66.5,13.05],[0,66,127,33,0,66.5,13.05],[127,66,127,33,0,65.5,13.05],[0,99,127,33,0,66.5,13.05],[127,99,127,33,0,66.5,13.05],[0,132,127,33,0,65.5,13.05],[127,132,127,33,0,66.5,13.05],[0,165,127,33,0,66.5,13.05],[127,165,127,33,0,65.5,13.05],[0,198,127,33,0,66.5,13.05],[127,198,127,64,0,66.5,13.05],[0,262,127,33,0,65.5,13.05]]});
var buttons_p = buttons.prototype = new createjs.Sprite();
buttons_p.Sprite_initialize = buttons_p.initialize;
buttons_p.initialize = function() {
	this.Sprite_initialize(buttons._SpriteSheet);
	this.paused = false;
}
window.buttons = buttons;
}(window));


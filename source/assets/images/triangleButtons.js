(function(window) {
triangleButtons = function() {
	this.initialize();
}
triangleButtons._SpriteSheet = new createjs.SpriteSheet({images: ["triangleButtons.png"], frames: [[0,0,86,166,0,42,85.55],[86,0,86,166,0,41,85.55],[0,166,86,166,0,41,85.55],[86,166,86,166,0,42,85.55],[0,332,86,166,0,41,85.55],[86,332,86,166,0,41,85.55]]});
var triangleButtons_p = triangleButtons.prototype = new createjs.Sprite();
triangleButtons_p.Sprite_initialize = triangleButtons_p.initialize;
triangleButtons_p.initialize = function() {
	this.Sprite_initialize(triangleButtons._SpriteSheet);
	this.paused = false;
}
window.triangleButtons = triangleButtons;
}(window));


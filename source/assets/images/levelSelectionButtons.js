(function(window) {
levelSelectionButtons = function() {
	this.initialize();
}
levelSelectionButtons._SpriteSheet = new createjs.SpriteSheet({images: ["levelSelectionButtons.png"], frames: [[0,0,153,152,0,75,75.1],[153,0,157,156,0,77,77.1],[310,0,181,180,0,89,90.1],[0,180,153,152,0,75,75.1],[153,180,157,156,0,77,77.1],[310,180,181,180,0,88,89.1],[0,360,146,145,0,72,74.1],[146,360,155,155,0,77,76.1],[301,360,184,182,0,93,90.1],[0,542,153,153,0,79,77.1],[153,542,157,157,0,80,80.1],[310,542,181,181,0,92,92.1],[0,723,145,145,0,70,73.1],[145,723,155,155,0,75,76.1],[300,723,184,182,0,91,91.1]]});
var levelSelectionButtons_p = levelSelectionButtons.prototype = new createjs.Sprite();
levelSelectionButtons_p.Sprite_initialize = levelSelectionButtons_p.initialize;
levelSelectionButtons_p.initialize = function() {
	this.Sprite_initialize(levelSelectionButtons._SpriteSheet);
	this.paused = false;
}
window.levelSelectionButtons = levelSelectionButtons;
}(window));


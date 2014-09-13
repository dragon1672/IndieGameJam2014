(function(window) {
ButtonTime = function() {
	this.initialize();
}
ButtonTime._SpriteSheet = new createjs.SpriteSheet({images: ["buttons.png"], frames: [[0,0,192,82,0,93.35,41],[192,0,192,82,0,94.35,41],[0,82,192,82,0,94.35,41],[192,82,192,82,0,93.35,41],[0,164,192,82,0,94.35,41],[192,164,192,82,0,94.35,41],[0,246,192,82,0,93.35,41],[192,246,192,82,0,94.35,41],[0,328,192,82,0,94.35,41],[192,328,192,82,0,93.35,41],[0,410,192,82,0,94.35,41],[192,410,192,82,0,94.35,41],[0,492,192,82,0,93.35,41],[192,492,192,82,0,94.35,41],[0,574,192,82,0,94.35,41],[192,574,192,82,0,93.35,41],[0,656,192,82,0,94.35,41],[192,656,192,82,0,94.35,41],[0,738,192,82,0,93.35,41],[192,738,192,82,0,94.35,41],[0,820,192,82,0,94.35,41]]});
var ButtonTime_p = ButtonTime.prototype = new createjs.Sprite();
ButtonTime_p.Sprite_initialize = ButtonTime_p.initialize;
ButtonTime_p.initialize = function() {
	this.Sprite_initialize(ButtonTime._SpriteSheet);
	this.paused = false;
}
window.ButtonTime = ButtonTime;
}(window));


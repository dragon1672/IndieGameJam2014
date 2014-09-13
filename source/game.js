/*jslint browser:true */
/*global createjs */
/*global Box2D */
/*global console */
//*jslint vars: false */
//*jslint unused: false */

//region TEMPLATE
var stage;
var FPS = 30;

//region keyCodes
    var KEYCODE_LEFT  = 37;
    var KEYCODE_UP    = 38;
    var KEYCODE_RIGHT = 39;
    var KEYCODE_DOWN  = 40;
    var KEYCODE_PLUS  = 187;
    var KEYCODE_MINUS = 189;
//endregion

//region gameStates
    function GameState (title) {
        this.title = title;
        this.container = new createjs.Container();
        this.masterEnable  = function() { this.container.visible = true;  this.enable();  };
        this.masterDisable = function() { this.container.visible = false; this.disable(); };
        // should override the following
        this.mouseDownEvent = function(e) { e=e; };
        this.mouseUpEvent = function(e) { e=e; };
        this.enable  = function() { };
        this.disable = function() { };
        this.update  = function() {};
    }
    var GameStates = {
        EMPTY : new GameState("empty"),
        Loading : new GameState("loading"),
        StartScreen : new GameState("start"),
        Instructions: new GameState("instructions"),
        Credits: new GameState("credits"),
        Game : new GameState("game"),
        GameOver : new GameState("game over"),
    };
    var CurrentGameState = GameStates.Loading;
    var LastGameState = GameStates.EMPTY;

//endregion

//region Classes
    var Timer = (function(){
        function Timer() {
            this.gameTimer = 0;
            this.frameCount = 0;
        }
        Timer.prototype.update = function(FPS) {
            this.frameCount = Math.max(0,this.frameCount+1);
            // lets make this only count 1/10s of a second
            if(this.frameCount%(FPS/10) === 0) {
                this.gameTimer = this.frameCount/(FPS);   
            }
        };
        Timer.prototype.reset = function() {
            this.frameCount = 0;
            this.gameTimer = 0;
        };
        Timer.prototype.addSeconds = function(seconds, FPS) {
            this.frameCount += seconds * FPS;
        };
        return Timer;
    }());
    
    var Vec2, Coord;
    Vec2 = Coord = (function(){
        function Coord(x,y) {
            if(x===undefined) {
                this.x = 0;
                this.y = 0;
            } else if(y === undefined) {
                this.x = x.x;
                this.y = x.y;
            } else {
                this.x = x;
                this.y = y;
            }
        }
        Coord.prototype.isEqual  = function(that) { return this.x === that.x && this.y === that.y; };
        Coord.prototype.toString = function() { return "{"+this.x+","+this.y+"}"; };
        //math
        Coord.prototype.add = function(that)     { return new Coord(this.x+that.x,this.y+that.y); };
        Coord.prototype.sub = function(that)     { return new Coord(this.x-that.x,this.y-that.y); };
        Coord.prototype.mul = function(constent) { return new Coord(constent * this.x,constent * this.y); };
        Coord.prototype.div = function(constent) { return this.mul(1/constent); };
        Coord.prototype.dot = function(that)     { return this.x * that.x + this.y * that.y; };
        Coord.prototype.lengthSquared = function() { return this.dot(this); };
        Coord.prototype.length     = function()    { return Math.sqrt(this.lengthSquared(this)); };
        Coord.prototype.normalized = function()    { return new Coord(this.x,this.y).div(Math.sqrt(this.lengthSquared(this))); };
        Coord.prototype.perpCW     = function()    { return new Coord(-this.y,this.x); };
        Coord.prototype.perpCCW    = function()    { return new Coord(this.y,-this.x); };
        Coord.prototype.LERP       = function(percent, that) { return this.mul(1-percent).add(that.mul(percent)); };
        Coord.prototype.cross      = function(that) { return this.x * that.y - this.y * that.x; };
        Coord.prototype.projection = function(norm) { return (this.dot(norm).mul(norm)).div(norm.lengthSquared()); };
        Coord.prototype.rejection  = function(norm) { return this.sub(this.projection(norm)); };
        Coord.prototype.isZero     = function()     { return this.x === 0 && this.y === 0;};
        Coord.prototype.withinBox  = function(exclusiveBounds) { return this.x >= 0 && this.y >= 0 && this.x < exclusiveBounds.x && this.y < exclusiveBounds.y; };
        Coord.prototype.wrapByBox  = function(exclusiveBounds) { return new Coord(this.x % exclusiveBounds.x + (this.x < 0 ? exclusiveBounds.x-1 : 0) , this.y % exclusiveBounds.y + (this.y < 0 ? exclusiveBounds.y-1 : 0)); };
        Coord.prototype.floor      = function()     { return new Coord(Math.floor(this.x),Math.floor(this.y)); };
        return Coord;
    }());

    //will have to make and manager per scene
    var KeyStateManager = (function(){
        function KeyStateManager(KEYCODE) {
            if(typeof(KEYCODE) === 'string') { KEYCODE = KEYCODE.charCodeAt(0); }
            this.keyCode = KEYCODE;
            this.numOfFramesClicked = 0;

            // override me
            this.onClick = function() {};
        }
        KeyStateManager.prototype.update = function() {
            this.numOfFramesClicked = keyStates[this.keyCode] === true ? this.numOfFramesClicked + 1 : 0;
            if(this.isDown()) { this.onClick(); }
        };
        KeyStateManager.prototype.isDown = function() { return this.numOfFramesClicked === 1; };
        return KeyStateManager;
    }());
    
//endregion

//region functions
    function stackButtons(buttons, padding, bottomPos) {
        bottomPos = bottomPos || new Coord(stage.canvas.width/2,padding);
        var offset = stage.canvas.height - padding;
        buttons.reverse();
        buttons.map(function(item) {
            if(typeof(item) != 'undefined' && typeof item.getBounds === 'function') {
                var pos = {
                    x: bottomPos.x,
                    y: offset-bottomPos.y,
                };

                offset -= item.getBounds().height + padding;
                item.x = pos.x;
                item.y = pos.y;
            }
        });
    }
    function moveAndLoop(object,speed,radius) {
        object.x += speed;
        if(object.x - radius > stage.canvas.width) {
            object.x = -radius;
        }
    }
    function generateRegButton(title) {
        return function(button,onClickMethod) {
            button.gotoAndStop(title+"Up");
            button.on("click", onClickMethod);
            button.on("mouseover", function(evt) { evt = evt; createjs.Sound.play("tinyTick"); button.gotoAndStop(title+"Over"); });
            button.on("mouseout",  function(evt) { evt = evt; button.gotoAndStop(title+"Up"); });
            button.on("mousedown", function(evt) { evt = evt; button.gotoAndStop(title+"Down"); });
            return button;
        };
    }
    function CreateButtonFromSprite(btnPlay, title, onClickMethod) {
        generateRegButton(title)(btnPlay,onClickMethod);
        return btnPlay;
    }
    //condition is a function(a) reutrns true/false
    function Where(theArray, condition) {
        var ret = [];
        theArray.map(function(item) { if(condition(item)) { ret.push(item); }});
        return ret;
    }
    function Rand(min,max) {
        return Math.round(Math.random() * (max - min) + min);
    }
    function RandomElement(array) {
        return array[Rand(0,array.length-1)];
    }
    function SingleSelect(array,selector) {
        selector = selector || function(a,b) { return a > b ? a : b; };
        var ret = null;
        array.map(function(item) { ret = ret === null ? item : selector(item,ret);});
        return ret;
    }
    function Max(array) { return SingleSelect(array,function(a,b) { return a > b ? a : b; }); }
    function Min(array) { return SingleSelect(array,function(a,b) { return a < b ? a : b; }); }
    function Sum(array) { return SingleSelect(array,function(a,b) { return a + b; }); }
    function Select(array,selector) {
        selector = selector || function(item) { return item; };
        var ret = [];
        array.map(function(item) { ret.push(selector(item));});
        return ret;
    }
//endregion

//region loading files
var manifest = [
    {src:"audio/Loading.mp3", id:"Loading"},
    {src:"images/Static/Title.png", id:"title"},
    {src:"images/Static/LevelSelection.png", id:"levelSelect"},
    {src:"images/Static/PauseMenu.png", id:"pauseMenu"},
    {src:"images/Static/Instructions.png", id:"instructions"},
    {src:"images/Static/GameOverPurplePlanet.png", id:"purGameover"},
    {src:"images/Static/GameOverBluePlanet.png", id:"bluGameover"},
    {src:"images/Static/WinPurplePlanet.png", id:"purWin"},
    {src:"images/Static/WinBluePlanet.png", id:"bluWin"},
    {src:"images/Static/Credits.png", id:"credits"},
    {src:"images/Terrain/BackgroundBasePurple.png", id:"purBackground"},
    {src:"images/Terrain/BackgroundBaseBlue.png", id:"bluBackground"},
    {src:"images/Terrain/pathOpenPurple.png", id:"purPath"},
    {src:"images/Terrain/pathOpenBlue.png", id:"bluPath"},
    {src:"audio/GameOver.mp3", id:"Failure"},
    {src:"audio/GamePlay.mp3", id:"GamePlay"},
    {src:"images/Static/purpleRockBlock.png", id:"purRock"},
    {src:"images/Static/blueRockBlock.png", id:"bluRock"},
    {src:"images/Static/purpleTreeBlock.png", id:"purTree"},
    {src:"images/Static/blueTreeBlock.png", id:"bluTree"},
    {src:"images/buttons.png", id:"button"},
    {src:"images/miniButtons.png", id:"miniButton"},
    {src:"images/levelSelectionButtons.png", id:"levelButton"},
    {src:"images/SpeakerOn.png", id:"SpeakerOn"},
    {src:"audio/StartScreen.mp3", id:"StartScreen"},
    {src:"images/SpeakerOff.png", id:"SpeakerOff"},
    {src:"audio/TinyTick.mp3", id:"tinyTick"},
    {src:"audio/Tick.mp3", id:"tick"},
    {src:"audio/Kaching.mp3", id:"kaching"},
    {src:"audio/KaBang.mp3", id:"kabang"},
    {src:"audio/Fizzle.mp3", id:"fizzle"},
    {src:"audio/Monster.mp3", id:"monster"},
    {src:"audio/Fire.mp3", id:"fire"},
    {src:"audio/Creep.mp3", id:"creep"},
    {src:"audio/Wave.mp3", id:"wave"},
    {src:"audio/ForJamie.mp3", id:"Friday"},
    {src:"images/stars.png", id:"Stars"},
    {src:"images/Hazard/jamieBlock.png", id:"jamie"},
    {src:"images/Hazard/LightningBolt.png", id:"bolt"},
    {src:"images/Hazard/tsunamiBlock.png", id:"tsunami"},
    {src:"images/Hazard/mantisBlock.png", id:"mantis"},
    {src:"images/Hazard/fireBlock.png", id:"fire"},
    {src:"images/Hazard/monsterBlock.png", id:"creeper"},
    {src:"images/Hazard/tsunamiSpawner.png", id:"tsunamiSpawn"},
    {src:"images/Hazard/mantisSpawner.png", id:"mantisSpawn"},
    {src:"images/Hazard/fireSpawner.png", id:"fireSpawn"},
    {src:"images/Hazard/monsterSpawner.png", id:"creeperSpawn"},
    {src:"images/Population/purplePop1.png", id:"purPop1"},
    {src:"images/Population/purplePop2.png", id:"purPop2"},
    {src:"images/Population/purplePop3.png", id:"purPop3"},
    {src:"images/Population/purplePop4.png", id:"purPop4"},
    {src:"images/Population/purplePop5.png", id:"purPop5"},
    {src:"images/Population/bluePop1.png", id:"bluPop1"},
    {src:"images/Population/bluePop2.png", id:"bluPop2"},
    {src:"images/Population/bluePop3.png", id:"bluPop3"},
    {src:"images/Population/bluePop4.png", id:"bluPop4"},
    {src:"images/Population/bluePop5.png", id:"bluPop5"},
];

var queue;

var backgroundMusic = {
    //private
    _enabled: true,
    _src: null,
    //public
    
    //allows audio to play
    enable: function() {
        if(!this._enabled && this._src !== null) {
            this._src.resume();
        }
        this._enabled = true;
    },
    
    //audio will stop
    disable: function() {
        if(this._src!==null) { this._src.pause(); }
        this._enabled = false;
    },
    
    //changes audio, if existing audio is playing, it will be stopped
    //will only play if already enabled
    setSound: function(newGuy) {
        var temp = this._enabled;
        this.disable();
        this._src = newGuy;
        this.disable();
        if(temp) { this.enable(); }
    },
    setSoundFromString: function(audioKey, loop) {
        var willLoop = loop ? {loop:-1} : null;
        var audio = createjs.Sound.play(audioKey,willLoop);
        this.setSound(audio);
    },
    //static functions
    isPaused: function(audio)    { return !audio.paused; },
    toggleMusic: function(audio) {
        return this.isPaused(audio) ? audio.resume() || true : audio.pause() && false;
    },
    
    //stops and sets audio src to null
    removeSound: function() {
        var temp = this._enabled;
        this.disable();
        this._src = null;
        this._enabled = temp;
    },
    
};

var spriteSheets = {
    buttons: null,
    miniButtons: null,
    levelButtons: null,
    stars: null,
    makeButton: function() {
        return (new createjs.Sprite(this.buttons));
    },
    makeMiniButton: function() {
        return (new createjs.Sprite(this.miniButtons));
    },
    makeLevelButton: function() {
        return (new createjs.Sprite(this.levelButtons));
    },
    makeStar: function() {
        return (new createjs.Sprite(this.stars));
    },
    mainCharacter: null
};

function loadImage(key) {
    return new createjs.Bitmap(queue.getResult(key));
}

function loadFiles() {
    
    
    queue = new createjs.LoadQueue(true, "assets/");  //files are stored in 'images' directory
    createjs.Sound.alternateExtensions = ["mp3"];
    queue.installPlugin(createjs.Sound);
    queue.on("complete", LoadComplete, this);  
    queue.on("progress", handleProgress, this);
    queue.addEventListener("fileload",playSound);
    function playSound(event) {
        if(event.item.id == "Loading") {
            backgroundMusic.setSoundFromString(event.item.src,true);
        }
    }
    
    var progress = new createjs.Shape(); 
    var progressBellow = new createjs.Shape();
    var txt = new createjs.Text();

    function ShapeData(widthPercent, height) {
        this.width = stage.canvas.width * widthPercent;
        this.height = height;
        this.x = stage.canvas.width / 2 - this.width / 2;
        this.y = stage.canvas.height / 2 - this.height / 2;
    }

    var dims = new ShapeData(50/100,100);

    progress.graphics.beginStroke("#280000").drawRect(dims.x,dims.y,dims.width,dims.height);
    progressBellow.graphics.beginStroke("#280000").drawRect(dims.x,dims.y,dims.width,dims.height);
    txt.x = dims.x+2;
    txt.y = dims.y+(dims.height) / 2 - 9;
    txt.font = ("13px Verdana");
    txt.color = ("#17A");
    
    function handleProgress(event) {
        progress.graphics.clear();
        // Draw the progress bar
        progress.graphics.beginFill("#ccc").drawRect(dims.x,dims.y,dims.width*(event.loaded / event.total),dims.height);
        txt.text = ("Loading " + 100*(event.loaded / event.total) + "%");
        stage.update();
    }
    function LoadComplete(event) {
        event = event;
        //once the files are loaded, put them into usable objects
        txt.text = "Click to continue";
        backgroundMusic.allLoaded = true;
        backgroundMusic.enable();
        progress.on("click",function() {
            backgroundMusic.setSoundFromString("StartScreen",true);
            initSprites();
            init();
        });
    }
    GameStates.Loading.container.addChild(progress,progressBellow,txt);
    
    queue.loadManifest(manifest);  //load files listed in 'manifest'
}

function initSprites() {
    var buttonSheet = new createjs.SpriteSheet({
        images: [queue.getResult("button")],
        frames: {width: 192, height: 82, regX: 96, regY: 40},
        animations: {
        playUp:   [0, 0, "playUp"],
        playOver: [1, 1, "playOver"],
        playDown: [2, 2, "playDown"],
        instructUp:   [3, 3, "instructUp"],
        instructOver: [4, 4, "instructOver"],
        instructDown: [5, 5, "instructDown"],
        menuUp:   [6, 6, "menuUp"],
        menuOver: [7, 7, "menuOver"],
        menuDown: [8, 8, "menuDown"],
        creditsUp:   [9, 9,   "creditsUp"],
        creditsOver: [10, 10, "creditsOver"],
        creditsDown: [11, 11, "creditsDown"],
        levelUp:   [12, 12, "levelUp"],
        levelOver: [13, 13, "levelOver"],
        levelDown: [14, 14, "levelDown"],
        retryUp:   [15, 15, "retryUp"],
        retryOver: [16, 16, "retryOver"],
        retryDown: [17, 17, "retryDown"],
        nextUp:   [18, 18, "nextUp"],
        nextOver: [19, 19, "nextOver"],
        nextDown: [20, 20, "nextDown"],
        } 
    });
    spriteSheets.buttons = buttonSheet;
    
    var miniButtonSheet = new createjs.SpriteSheet({
        images: [queue.getResult("miniButton")],
        frames: {width: 127, height: 33, regX: 64, regY: 17},
        animations: {
        miniMenuUp:   [0, 0, "miniMenuUp"],
        miniMenuOver: [1, 1, "miniMenuOver"],
        miniMenuDown: [2, 2, "miniMenuDown"],
        miniQuitUp:   [3, 3, "miniQuitUp"],
        miniQuitOver: [4, 4, "miniQuitOver"],
        miniQuitDown: [5, 5, "miniQuitDown"],
        miniHelpUp:   [6, 6, "miniHelpUp"],
        miniHelpOver: [7, 7, "miniHelpOver"],
        miniHelpDown: [8, 8, "miniHelpDown"],
        miniBackUp:   [9, 9,   "miniBackUp"],
        miniBackOver: [10, 10, "miniBackOver"],
        miniBackDown: [11, 11, "miniBackDown"],
        miniRetryUp:   [12, 12,   "miniRetryUp"],
        miniRetryOver: [13, 13, "miniRetryOver"],
        miniRetryDown: [14, 14, "miniRetryDown"],
        } 
    });
    spriteSheets.miniButtons = miniButtonSheet;
    
    var levelButtonSheet = new createjs.SpriteSheet({
        images: [queue.getResult("levelButton")],
        frames: {width: 117, height: 117, regX: 58, regY: 58},
        animations: {
        level1Up:   [0, 0,   "level1Up"],
        level1Over: [1, 1,   "level1Over"],
        level1Down: [2, 2,   "level1Down"],
        level2Up:   [3, 3,   "level2Up"],
        level2Over: [4, 4,   "level2Over"],
        level2Down: [5, 5,   "level2Down"],
        level3Up:   [6, 6,   "level3Up"],
        level3Over: [7, 7,   "level3Over"],
        level3Down: [8, 8,   "level3Down"],
        level4Up:   [9, 9,   "level4Up"],
        level4Over: [10, 10, "level4Over"],
        level4Down: [11, 11, "level4Down"],
        level5Up:   [12, 12, "level5Up"],
        level5Over: [13, 13, "level5Over"],
        level5Down: [14, 14, "level5Down"],
        } 
    });
    spriteSheets.levelButtons = levelButtonSheet;
    //This takes the images loaded from the sprite sheet and breaks it into the individual frames. I cut and pasted the 'frames' parameter from the .js file created by Flash when I exported in easelJS format. I didn't cut and paste anything except 'frames' because I am using preloadJS to load all the images completely before running the game. That's what the queue.getResult is all about.
    
    var starSheet = new createjs.SpriteSheet({
        images: [queue.getResult("Stars")],
        frames: {width: 128, height: 128, regX: 64, regY: 64},
        animations: {
        empty:   [0, 0, "empty"],
        quarter: [1, 1, "quarter"],
        half: [2, 2, "half"],
        quarter3:   [3, 3, "quarter3"],
        full: [4, 4, "full"],
        } 
    });
    spriteSheets.stars = starSheet;
}

//endregion

//region init
    //region global assets (mouse and keys)
        var mouse = {
            pos: new Coord(),
            isDown: false,
        };
        function mouseInit() {
            stage.enableMouseOver();
            stage.on("stagemousemove", function(evt) {
                mouse.pos.x = Math.floor(evt.stageX);
                mouse.pos.y = Math.floor(evt.stageY);
            });
            stage.on("stagemousedown",function(e) {
                CurrentGameState.mouseDownEvent(e);
                mouse.isDown = true;
            });
            stage.on("stagemouseup",function(e) {
                CurrentGameState.mouseUpEvent(e);
                mouse.isDown = false;
            });
        }
        
        //universial across all scenes
        var keyStates = [];
        function handleKeyDown(evt) {
            if(!CurrentGameState) { return; }
            if(!evt){ evt = window.event; }  //browser compatibility
            keyStates[evt.keyCode] = true;
            //console.log(evt.keyCode+"up");
        }
        function handleKeyUp(evt) {
            if(!CurrentGameState) { return; }
            if(!evt){ evt = window.event; }  //browser compatibility
            keyStates[evt.keyCode] = false;
            //console.log(evt.keyCode+"down");
        }
        document.onkeydown = handleKeyDown;
        document.onkeyup = handleKeyUp;
    //endregion
    
    function setupCanvas() {
        var canvas = document.getElementById("game");
        canvas.width = 800;
        canvas.height = 600;
        stage = new createjs.Stage(canvas);
    }

    function registerGameLoop() {
        function loop() {
            if(CurrentGameState != LastGameState) {
                LastGameState.masterDisable();
                CurrentGameState.masterEnable();
            }
            LastGameState = CurrentGameState;
            CurrentGameState.update();
            stage.update();
        }
        createjs.Ticker.addEventListener("tick", loop);
        createjs.Ticker.setFPS(FPS);
    }
    
    function main() {
        setupCanvas();
        mouseInit();
        initLoadingScreen();
        registerGameLoop();

        loadFiles();
    }
    
    if (!!(window.addEventListener)) {
        window.addEventListener("DOMContentLoaded", main);
    } else { // if IE
        window.attachEvent("onload", main);
    }
//endregion

var score = 0;

//to be called after files have been loaded
function init() {
    GameStates.StartScreen.container.addChild(  loadImage("title")        );
    GameStates.Instructions.container.addChild( loadImage("instructions") );
    GameStates.Credits.container.addChild(      loadImage("credits") );
    stage.addChild(GameStates.EMPTY.container);         GameStates.EMPTY.masterDisable();
    stage.addChild(GameStates.StartScreen.container);   GameStates.StartScreen.masterDisable();
    stage.addChild(GameStates.Instructions.container);  GameStates.Instructions.masterDisable();
    stage.addChild(GameStates.Credits.container);       GameStates.Credits.masterDisable();
    stage.addChild(GameStates.Game.container);          GameStates.Game.masterDisable();
    stage.addChild(GameStates.GameOver.container);      GameStates.GameOver.masterDisable();
    
    //adding speaker
    var speaker = {
        onImg: loadImage("SpeakerOn"),
        offImg: loadImage("SpeakerOff"),
    };
    speaker.onImg.x = stage.canvas.width  - speaker.onImg.getBounds().width-20;
    speaker.onImg.y = stage.canvas.height - speaker.onImg.getBounds().height-20;
    speaker.offImg.x = speaker.onImg.x;
    speaker.offImg.y = speaker.onImg.y;
    speaker.onImg.on("click", function() {
        speaker.onImg.visible  = false;
        speaker.offImg.visible = true;
        backgroundMusic.disable();
    });
    speaker.offImg.on("click", function() {
        speaker.offImg.visible = false;
        speaker.onImg.visible  = true;
        backgroundMusic.enable();
    });
    speaker.offImg.visible = false;
    stage.addChild(speaker.onImg);
    stage.addChild(speaker.offImg);
    
    
    //init start
    {
        GameStates.StartScreen.enable = function() {
            backgroundMusic.setSoundFromString("StartScreen",true);
        };
        var BTN = [];
        BTN.push(CreateButtonFromSprite(spriteSheets.makeButton(),"play",    function() { CurrentGameState = GameStates.Game;createjs.Sound.play("tick");}));
        BTN.push(CreateButtonFromSprite(spriteSheets.makeButton(),"instruct",function() { CurrentGameState = GameStates.Instructions; createjs.Sound.play("tick");}));
        BTN.push(CreateButtonFromSprite(spriteSheets.makeButton(),"level",    function() { 
            BTN.map(function(item) {
                GameStates.StartScreen.container.removeChild(item);
            });
            var subMenu = loadImage("levelSelect");
            CurrentGameState.container.addChild(subMenu);
            var mBTN = [];
            mBTN.push(CreateButtonFromSprite(spriteSheets.makeButton(),"menu",    function() {
                createjs.Sound.play("tick");
                mBTN.map(function(item) {
                    GameStates.StartScreen.container.removeChild(item);
                });
                BTN.map(function(item) {
                    GameStates.StartScreen.container.addChild(item);
                });
                GameStates.StartScreen.container.removeChild(subMenu);
            }));
            mBTN[0].x=400;
            mBTN[0].y=450;
            mBTN.push(CreateButtonFromSprite(spriteSheets.makeLevelButton(),"level1",    function() {
                createjs.Sound.play("tick");
                mBTN.map(function(item) {
                    GameStates.StartScreen.container.removeChild(item);
                });
                BTN.map(function(item) {
                    GameStates.StartScreen.container.addChild(item);
                });
                GameStates.StartScreen.container.removeChild(subMenu);
                currentLevel=0;
                CurrentGameState = GameStates.Game;
            }));
            mBTN[1].x=200;
            mBTN[1].y=430;
            mBTN.push(CreateButtonFromSprite(spriteSheets.makeLevelButton(),"level2",    function() {
                createjs.Sound.play("tick");
                mBTN.map(function(item) {
                    GameStates.StartScreen.container.removeChild(item);
                });
                BTN.map(function(item) {
                    GameStates.StartScreen.container.addChild(item);
                });
                GameStates.StartScreen.container.removeChild(subMenu);
                currentLevel=1;
                CurrentGameState = GameStates.Game;
            }));
            mBTN[2].x=275;
            mBTN[2].y=310;
            mBTN.push(CreateButtonFromSprite(spriteSheets.makeLevelButton(),"level3",    function() {
                createjs.Sound.play("tick");
                mBTN.map(function(item) {
                    GameStates.StartScreen.container.removeChild(item);
                });
                BTN.map(function(item) {
                    GameStates.StartScreen.container.addChild(item);
                });
                GameStates.StartScreen.container.removeChild(subMenu);
                currentLevel=2;
                CurrentGameState = GameStates.Game;
            }));
            mBTN[3].x=400;
            mBTN[3].y=280;
            mBTN.push(CreateButtonFromSprite(spriteSheets.makeLevelButton(),"level4",    function() {
                createjs.Sound.play("tick");
                mBTN.map(function(item) {
                    GameStates.StartScreen.container.removeChild(item);
                });
                BTN.map(function(item) {
                    GameStates.StartScreen.container.addChild(item);
                });
                GameStates.StartScreen.container.removeChild(subMenu);
                currentLevel=3;
                CurrentGameState = GameStates.Game;
            }));
            mBTN[4].x=525;
            mBTN[4].y=310;
            mBTN.push(CreateButtonFromSprite(spriteSheets.makeLevelButton(),"level5",    function() {
                createjs.Sound.play("tick");
                mBTN.map(function(item) {
                    GameStates.StartScreen.container.removeChild(item);
                });
                BTN.map(function(item) {
                    GameStates.StartScreen.container.addChild(item);
                });
                GameStates.StartScreen.container.removeChild(subMenu);
                currentLevel=4;
                CurrentGameState = GameStates.Game;
            }));
            mBTN[5].x=600;
            mBTN[5].y=430;
            mBTN.map(function(item) {
                GameStates.StartScreen.container.addChild(item);
            });
            createjs.Sound.play("tick");
        }));
        BTN.push(CreateButtonFromSprite(spriteSheets.makeButton(),"credits", function() { CurrentGameState = GameStates.Credits; createjs.Sound.play("tick");}));
        
        stackButtons(BTN,10,new Coord(600,100));
        
        BTN.map(function(item) {
            GameStates.StartScreen.container.addChild(item);
        });
    }
    var PADDING = 5;
    //init instructions
    {
        var BTN_mainMenu = spriteSheets.makeButton();
        CreateButtonFromSprite(BTN_mainMenu,"menu",function() { CurrentGameState = GameStates.StartScreen; createjs.Sound.play("tick");});
        BTN_mainMenu.x = stage.canvas.width - BTN_mainMenu.getBounds().width - PADDING+20;
        BTN_mainMenu.y = stage.canvas.height - BTN_mainMenu.getBounds().height - PADDING+20;
        GameStates.Instructions.container.addChild(BTN_mainMenu);
        
    }
    //init credits
    {
        var BTN_mainMenu_creditsScreen = CreateButtonFromSprite(spriteSheets.makeButton(),"menu",function() { CurrentGameState = GameStates.StartScreen; createjs.Sound.play("tick");});
        BTN_mainMenu_creditsScreen.x = stage.canvas.width - BTN_mainMenu_creditsScreen.getBounds().width - PADDING;
        BTN_mainMenu_creditsScreen.y = stage.canvas.height - BTN_mainMenu_creditsScreen.getBounds().height - PADDING;
        GameStates.Credits.container.addChild(BTN_mainMenu_creditsScreen);
        
    }
    //init game
    initGameScene(GameStates.Game.container);
    //init gameOver
    {
        
        var finalScore = new createjs.Text("Score:\n"+score, "italic 36px Orbitron", "#FFF");
        finalScore.x = stage.canvas.width / 2 - 50;
        finalScore.y = stage.canvas.height / 2;
        var btns = [];
        
        GameStates.GameOver.enable = function() {
            
            btns.push(CreateButtonFromSprite(spriteSheets.makeButton(),"menu",function() { CurrentGameState = GameStates.StartScreen; createjs.Sound.play("tick");}));
            btns[0].x = 200;
            btns[0].y = 400;
            btns.push(CreateButtonFromSprite(spriteSheets.makeButton(),"retry",function() {CurrentGameState = GameStates.Game; createjs.Sound.play("tick");}));
            btns[1].x = 600;
            btns[1].y = 400;
            if(currentLevel<levels.length-1&&victory){
                btns.push(CreateButtonFromSprite(spriteSheets.makeButton(),"next",function() {currentLevel++;CurrentGameState = GameStates.Game; createjs.Sound.play("tick");}));
                btns[2].x = 400;
                btns[2].y = 450;
            }
            if(victory)backgroundMusic.setSoundFromString("StartScreen",true);
            else backgroundMusic.setSoundFromString("Failure",true);
            GameStates.GameOver.container.addChild(finalScore);
            btns.map(function(item) {
                GameStates.GameOver.container.addChild(item);
            });
        };
        
        
        GameStates.GameOver.update = function() {
            finalScore.text = "Score:\n"+score;
        };
        GameStates.GameOver.disable = function() {
            GameStates.GameOver.container.removeChild(finalScore);
            btns.map(function(item) {
                GameStates.GameOver.container.removeChild(item);
            });
            while(btns.length>0){
                btns.pop();
            }
        };
    }
    CurrentGameState = GameStates.StartScreen;
}
//progress bar will run anything listed here should only be animation stuff without using any images
function initLoadingScreen() {
    function randomDir() {
        var ret = new Coord();
        ret.x = Rand(-1,1);
        ret.y = Rand(-1,1);
        return ret.normalized();
    }
    var maxScale = 3;
    function circle(pos) {
        pos = pos || new Coord();
        this.pos = new Coord();
        this.dir = randomDir().mul(Rand(3,6));
        this.graphic = new createjs.Shape();
        this.graphic.graphics.beginFill("#FFF").drawCircle(0, 0, Rand(2,6));
        this.graphic.x = pos.x;
        this.graphic.y = pos.y;
        this.scale = Rand(0,maxScale);
    }
    circle.prototype.update = function() {
        this.pos = this.pos.add(this.dir);
        this.pos = this.pos.wrapByBox(screenDims);
        this.graphic.x = this.pos.x;
        this.graphic.y = this.pos.y;
        
        this.scale += 0.1;
        this.scale %= maxScale;
        
        this.graphic.scaleX = Math.abs(this.scale-maxScale/2) + 1;
        this.graphic.scaleY = Math.abs(this.scale-maxScale/2) + 1;
    };
    var background = new createjs.Shape();
    background.graphics.beginFill("#000").drawRect(0, 0, stage.canvas.width,stage.canvas.height);
    GameStates.Loading.container.addChild(background);
    var circles = [];
    for(var i=0;i<150;i++) {
        var toAdd = new circle();
        toAdd.pos.x = Rand(0,stage.canvas.width);
        toAdd.pos.y = Rand(0,stage.canvas.height);
        circles.push(toAdd);
        GameStates.Loading.container.addChild(toAdd.graphic);
    }
    
    var screenDims = new Coord(stage.canvas.width,stage.canvas.height);
        
    GameStates.Loading.update = function() {
        moveAndLoop(circle,2,40);
        circles.map(function(item) {
            item.update();
        });
    };
    stage.addChild(GameStates.Loading.container);
    CurrentGameState = GameStates.Loading;
}
//endregion

//region GAMEOBJECT
//region copy pasted code

function Where(theArray, condition) {
    var ret = [];
    theArray.map(function(item) { if(condition(item)) { ret.push(item); }});
    return ret;
}
function Rand(min,max) {
    return Math.round(Math.random() * (max - min) + min);
}
function RandomElement(array) {
    return array[Rand(0,array.length-1)];
}
function SingleSelect(array,selector) {
    selector = selector || function(a,b) { return a > b ? a : b; };
    var ret = null;
	var first = true;
    array.map(function(item) {
		ret = first ? item : selector(item,ret);
		first = false;
	});
    return ret;
}
function Max(array) { return SingleSelect(array,function(a,b) { return a > b ? a : b; }); }
function Min(array) { return SingleSelect(array,function(a,b) { return a < b ? a : b; }); }
function Sum(array) { return SingleSelect(array,function(a,b) { return a + b; }); }
function Select(array,selector) {
    selector = selector || function(item) { return item; };
    var ret = [];
    array.map(function(item) { ret.push(selector(item));});
    return ret;
}

//endregion

//region hasy

/*
 * Hash table developed by Anthony Corbin
//*/
var HashTable, HashMap;
 HashTable = HashMap = (function() {
	function HashTable() {
		this.pairs = [];
		this.orderedPairs = [];
        this.numOfActiveIterations = 0;
	}
	function KeyValuePair(hash, key, val) {
		this.hash = hash;
		this.key = key;
		this.val = val;
        this.markedForDel = false;
	}
    
    var hasher = function (value) {
        return (typeof value) + ' ' + (value instanceof Object ? (value.__hash || (value.__hash = ++arguments.callee.current)) : value.toString());
    };
    hasher.current = 0;
    
    HashTable.prototype.hashObject = hasher;
	KeyValuePair.prototype.containsKey = function (key) { return this.key === key; };
	KeyValuePair.prototype.containsVal = function (val) { return this.val === val; };
	HashTable.prototype.add = function (newKey, newVal) {
		var hash = this.hashObject(newKey);
		if (!this.containsKey(newKey)) {
			this.pairs[hash] = new KeyValuePair(hash, newKey, newVal);
			this.orderedPairs.push(this.pairs[hash]);
		} else {
			this.pairs[hash].val = newVal;
		}
	};
	HashTable.prototype.put  = this.add;
	HashTable.prototype.get = function (key) {
		var hash = this.hashObject(key);
		if (this.pairs[hash] !== null) { return this.pairs[hash].val; }
		return null;
	};
	HashTable.prototype.remove = function (key) {
		var i, hash;
		if (this.containsKey(key)) {
			hash = this.hashObject(key);
            this.pairs[hash].markedForDel = true;
            var potato = this;
            var del = function del() {
                if(potato.numOfActiveIterations > 0) {
                    setTimeout(del,10);
                    return;
                }
                for (i = 0; i < potato.orderedPairs.length; i++) {
                    if (potato.orderedPairs[i] === potato.pairs[hash]) {
                        potato.orderedPairs.splice(i, 1);
                        potato.pairs[hash] = null;
                        return;
                    }
                }
                throw new Error("contain returned true, but key not found");
            };
            del();
		}
	};
	HashTable.prototype.containsKey = function (key) {
		var hash = this.hashObject(key);
		return (this.pairs[hash] && (this.pairs[hash] instanceof KeyValuePair)) ? true : false;
	};
	HashTable.prototype.containsValue = function (val) {
		var ret = false;
		this.orderedPairs.map(function (item) {
			ret = ret || item.val === val;
		});
		return ret;
	};
	HashTable.prototype.isEmpty = function () { return this.size() === 0; };
	HashTable.prototype.size = function () { return this.orderedPairs.length; };
	//pass in function(key,val)
	HashTable.prototype.foreachInSet = function (theirFunction) {
        this.numOfActiveIterations++;
		this.orderedPairs.map(function (item) {
            if(!item.markedForDel) {
                theirFunction(item.key, item.val);
            }
		});
        this.numOfActiveIterations--;
	};
    HashTable.prototype.map = HashTable.prototype.foreachInSet;
	return HashTable;
}());

/*
 * Hash Set developed by Anthony Corbin
//*/
var HashSet = (function() {
	function HashSet() {
		this.myTable = new HashTable();
	}
	HashSet.prototype.add      = function (val)      { return this.myTable.add(val, true);       };
	HashSet.prototype.addAll   = function (vals)     { var potato = this; vals.map(function(item) { potato.myTable.add(item,true); }); };
	HashSet.prototype.contains = function (toCheck)  { return this.myTable.containsKey(toCheck); };
	HashSet.prototype.remove   = function (toRemove) { return this.myTable.remove(toRemove);     };
	HashSet.prototype.size     = function ()         { return this.myTable.size(); };
    
    HashSet.prototype.cross = function (that) {
		var ret = new HashSet();
		this.foreachInSet(function (a) {
            that.foreachInSet(function (b) {
                var toAdd = {
                    0: a,
                    1: b,
                };
                ret.add(toAdd);
            });
        });
		return ret;
	};
	HashSet.prototype.union = function (that) {
		var ret = new HashSet();
		this.foreachInSet(function (item) { ret.add(item); });
		that.foreachInSet(function (item) { ret.add(item); });
		return ret;
	};
	HashSet.prototype.join  = function (that) {
		var ret = new HashSet();
		this.myTable.foreachInSet(function (key, val) {
			if (that.contains(key)) { ret.add(key); }
		});
		return ret;
	};
    HashSet.prototype.removeSet = function (that) {
        that.foreachInSet(function(item) {
            this.remove(item); 
        });
	};
    HashSet.prototype.isEqual   = function (that) {
		return this.isSubsetOf(that) && that.isSuperSet(this);
	};
    HashSet.prototype.isSubSet  = function (that) {
		var ret = true;
		this.myTable.foreachInSet(function (item) {
            ret = ret && that.contains(item);
		});
		return ret;
	};
    HashSet.prototype.isSuperSet   = function (that) {
        return that.isSubSet(this);
	};
	HashSet.prototype.foreachInSet = function (theirFunction) {
		return this.myTable.foreachInSet(function(key,val) { theirFunction(key); });
	};
    HashSet.prototype.map = HashSet.prototype.foreachInSet;
    HashSet.prototype.toList = function () {
        var ret = [];
		this.foreachInSet(function (item) {
            ret.push(item);
		});
        return ret;
	};
    return HashSet;
})();

//endregion

//region classes
var ItemType = { // enum
    Hazard: "haz",
    Housing: "woody",
    Static: "oldTv",
    ComboMaster: "combine with all",
    BlackHole: "Anything will die",
};

function Cell(pos) {
    this.isPlaceable = true;
    this.item = null;
    this.pos = pos;
}

function Query(valid) {
    this.levelBoost = 0;
    this.positions = [];
    this.cells = [];
    this.valid = valid;
    this.alreadyOccupied = false;
}

function Item(type) {
    this.population = 0;
    this.direction = new Coord();
    this.strength = 0;
    this.type = type;
    this.getLevel = function() {
        return this.strength;
    };
    this.setToLevel = function(level) {
        this.strength = level;
    };
    this.duplicate = function() {
        var ret = new Item(this.type);
        ret.update     = this.update;
        ret.population = this.population;
        ret.direction  = this.direction;
        ret.strength   = this.strength;
        return ret;
    };
    this.isEqual = function(that) {
        if(that === null) { return false; }
        return this.getLevel() === that.getLevel() && 
               this.direction.isEqual(that.direction) && 
               this.strength === that.strength &&
               this.type === that.type;
    };
    this.decreaseLevel = function() {
        this.population -= this.population / this.getLevel();
        this.setToLevel(this.getLevel()-1);
    };
}
function Hazard(level) {
    this.pos = new Coord();
    this.direction = new Coord();
    this.level = level;
    this.getLevel = function() {
        return this.level;
    };
    this.setToLevel = function(level) {
        this.level = level;
    };
    this.duplicate = function() {
        var ret    = new Hazard(this.getLevel());
        ret.pos    = this.pos;
        ret.direction  = this.direction;
        ret.level  = this.level;
        return ret;
    };
    this.isEqual = function(that) {
        if(that === null) { return false; }
        return this.getLevel() === that.getLevel() && 
               this.direction.isEqual(that.direction) && 
               this.level === that.level;
    };
    this.decreaseLevel = function() {
        this.level--;
    };
}
var GameEvent = (function(){
    function GameEvent() {
        this.calls = new HashSet();
    }
    GameEvent.prototype.callAll = function(a,b,c,d,e,f,g) {
        this.calls.foreachInSet(function(item) { item(a,b,c,d,e,f,g); });
    };
    GameEvent.prototype.addCallBack = function(toAdd) {
        this.calls.add(toAdd);
    };
    GameEvent.prototype.removeCallBack = function (toKill) {
        this.calls.remove(toKill);
    };
    return GameEvent;
}());

function Spawner(freqLow,freqHigh, powerLow, powerHigh) {
    freqLow   = freqLow   || 5;
    freqHigh  = freqHigh  || 10;
    powerLow  = powerLow  || 3;
    powerHigh = powerHigh || 4;
    this.pos = new Coord();
    this.directions = [];
    //power of hazard
    this.powLow = powerLow;
    this.powHigh = powerHigh;
    
    //how often hazards are spawn
    this.freqLow = freqLow;
    this.freqHigh = freqHigh;
    this.turnsTillNextSpawn = Rand(this.freqLow,this.freqHigh); // will be updated based off freq
    //will be changed 
    this.updateTurns = function() {
        this.turnsTillNextSpawn--;
        if(this.turnsTillNextSpawn < 0) {
            this.turnsTillNextSpawn = Rand(this.freqLow,this.freqHigh);
            //spawn
            var ret = new Hazard(Rand(this.powLow,this.powHigh));
            ret.pos = this.pos;
            ret.direction = RandomElement(this.directions);
            return ret;
        }
        return null;
    };
}


//endregion

//region Game
var Game = (function() {
    //pass x,y or size
    function Game(x,y) {
        x = x || new Coord(5,5);
        this.size = y === undefined ? x : new Coord(x,y);
        this.turns = 42;
        this.Grid = [];
        this.ComboBoost = 3;
        this.avalableItemPool = [];

        this.spawners = [];
        this.trackedHazards = new HashSet();
        
        this.stats = {
            popGained: 0,
            popLost: 0,
            highestPop: 0,
            totalThingsKilled: 0,
            _lastPop: 0,
        };
        
        this.cheats = false;
        
        //region events

        //function(pos,oldItem, new item)
        this.itemChangedEvent = new GameEvent();
        //function(pos,hazard)
        this.hazardSpawnedEvent = new GameEvent();
        //function(oldPos,newPos)
        this.hazardMovedEvent = new GameEvent();
        //function(pos,hazard)
        this.hazardRemovedEvent = new GameEvent();
        
        //function(pos,olditem,newitem,hazard) // fires in addition to item changed
        this.itemLostLevels = new GameEvent();

        //function()
        this.itemQChangedEvent = new GameEvent();
        //function()
        this.populationChangedEvent = new GameEvent();
        var pinePickle = this;
        this.populationChangedEvent.addCallBack(function() {
            var pop = pinePickle.getPopulation();
            var diff = pop - pinePickle.stats._lastPop;
            pinePickle.stats._lastPop = pop;
            if(diff < 0) { pinePickle.stats.popGained -= diff; }
            if(diff > 0) { pinePickle.stats.popGained += diff; }
            pinePickle.stats.highestPop = Math.max(pinePickle.stats.highestPop,pop);
        });

        //endregion

        //region init
        var i;
        { // init pool
            var basicHouse = new Item(ItemType.Housing);
            basicHouse.population = 1;
            basicHouse.strength = 1;
            this.addItemToPool(basicHouse,5);
            //adding powerups
            this.addItemToPool(new Item(ItemType.BlackHole),1);
        }
        this.nextItemList = [];

        //init grid
        for(i=0;i<this.size.x;i++) {
            this.Grid[i] = [];
            for(var j=0;j<this.size.y;j++) {
                this.Grid[i][j] = new Cell(new Coord(i,j));
            }
        }

        //endregion

        //for building map
    }
    
    Game.prototype.getDims = function() { return this.size; };
    Game.prototype.setComboBoost = function(boost) {
        this.ComboBoost = boost;
    };
    Game.prototype.addSpawner = function(spawner) { this.spawners.push(spawner);};
    
    Game.prototype.addHazard = function(toAdd) { this.trackedHazards.add(toAdd); };
    Game.prototype.removeHazard = function(toKill) { this.trackedHazards.remove(toKill); };
    Game.prototype.addItemToPool = function(item,count) {
        count = count || 1;
        for(var i = 0 ;i<count;i++) {
            this.avalableItemPool.push(item.duplicate());
        }
    };
    Game.prototype.foreachCell = function(operation) {
        for(var i=0;i<this.size.x;i++) {
            for(var j=0;j<this.size.y;j++) {
                operation(this.Grid[i][j]);
            }
        }
    };
    //public functions
    Game.prototype.getTurnCount  = function() { return this.turns; };
    Game.prototype.popFromQ = function() {
        this.itemQ(0);
        var ret = this.nextItemList.shift();
        this.itemQChangedEvent.callAll();
        return ret;
    };
    Game.prototype.itemQ         = function(index) {
        while(this.nextItemList.length <= index) {
            this.nextItemList.push(RandomElement(this.avalableItemPool).duplicate());
        }
        return this.nextItemList[index];
    };
    Game.prototype.QueryMove     = function(pos,itemToPlace) {
        itemToPlace = itemToPlace || this.itemQ(0);
        var thisCell = this.getCell(pos);
        var ret = new Query(thisCell !== null);
        ret.alreadyOccupied = thisCell.item !== null;
        function pushToRet(cellToAdd) {
            ret.cells.push(cellToAdd);
            ret.positions.push(cellToAdd.pos);
        }

        var itemToCheck = itemToPlace.duplicate();
        var sameType;
        while( (sameType = this.MoveHelper(new HashSet(),this.getCell(pos),itemToCheck)).length >=3 ) {
            itemToCheck.setToLevel(itemToCheck.getLevel()+1);
            ret.levelBoost = itemToCheck.getLevel() - itemToPlace.getLevel();
            sameType.map(pushToRet);
        }
        ret.valid = ret.positions.length > 2;
        return ret;
    };
    Game.prototype.MoveHelper = function(visistedPool,current, item) {
        item = item || current.item;
        if(item === null) { throw new Error("must have item to compare with"); }
        var ret = [];
        if(current === null || visistedPool.contains(current)) { return ret; }

        visistedPool.add(current);
        ret.push(current);

        var sameTypeNeighbors = Where(this.getCellNeighbors(current.pos),function(that) { return item.isEqual(that.item); });
        var potato = this;
        sameTypeNeighbors.map(function(buddy) {
            var buddyPals = potato.MoveHelper(visistedPool,buddy); // this is breaking :(
            buddyPals.map(function(item) {
               ret.push(item); 
            });
        });
        return ret;
    };

    //pass
    //ApplyMove(Query)
    //ApplyMove(pos, optionalItem)
    Game.prototype.ApplyMove     = function(pos,itemToPlace, preloadedQuery) {
        if(pos instanceof(Query)) {
            preloadedQuery = pos;
            pos = preloadedQuery.cells[0].pos;
        }
        var thisCell = this.getCell(pos);
        if(thisCell === null) { throw new Error("Must apply move to valid cell"); }
        if(thisCell.item !== null) { console.log("warning placing ontop of existing cell"); }


        itemToPlace = itemToPlace || this.popFromQ();

        if(itemToPlace.type === ItemType.Housing) {
            preloadedQuery = preloadedQuery || this.QueryMove(pos,itemToPlace);

            this.avalableItemPool.push(itemToPlace.duplicate());

            var potato = this;
            if(preloadedQuery.valid) {
                preloadedQuery.cells.map(function(meCell) {
                    if(!meCell.pos.isEqual(pos)) {
                        itemToPlace.population += meCell.item.population;
                        var old = meCell.item;
                        meCell.item = null;
                        potato.itemChangedEvent.callAll(meCell.pos,old,null);
                    }
                });
                itemToPlace.population += preloadedQuery.levelBoost * this.ComboBoost;
                itemToPlace.setToLevel(itemToPlace.getLevel()+preloadedQuery.levelBoost);
            }
            var old = thisCell.item;
            thisCell.item = itemToPlace;
            this.itemChangedEvent.callAll(thisCell.pos,old,itemToPlace);
            this.avalableItemPool.push(itemToPlace.duplicate());
        } else {
            if(itemToPlace.type === ItemType.BlackHole) {
                preloadedQuery = new Query(true);
                preloadedQuery.alreadyOccupied = thisCell.item !== null;
                thisCell.item = null;
                var hazards = this.getHazardAt(pos);
                var pineTree = this;
                hazards.map(function(item) {
                    pineTree.hazardRemovedEvent.callAll(item.pos,item);
                    pineTree.removeHazard(item);
                });
            }
        }

        this.turns--;
        this.update();
        this.populationChangedEvent.callAll();

        return preloadedQuery;
    };
    
    Game.prototype.inBounds      = function(x,y) {
        var pos = y === undefined ? x : new Coord(x,y);
        return pos.withinBox(this.getDims());
    };
    Game.prototype.getCell       = function(x,y) {
        var pos = y === undefined ? x : new Coord(x,y);
        if(pos.withinBox(this.getDims())) { return this.Grid[pos.x][pos.y]; }
        if(this.inBounds(pos)) { return this.Grid[pos.x][pos.y]; }
        return null;
    };
    Game.prototype.getCellNeighbors = function(cellPos) {
        var temp = null;
        var ret = [];
        temp = this.getCell(cellPos.add(new Coord( 1, 0))); if(temp !== null) { ret.push(temp); }
        temp = this.getCell(cellPos.add(new Coord( 0, 1))); if(temp !== null) { ret.push(temp); }
        temp = this.getCell(cellPos.add(new Coord(-1, 0))); if(temp !== null) { ret.push(temp); }
        temp = this.getCell(cellPos.add(new Coord( 0,-1))); if(temp !== null) { ret.push(temp); }
        return ret;
    };
    Game.prototype.getPopulation = function() {
        var ret = 0;
        this.foreachCell(function(cell) {
            ret += cell.item !== null ? cell.item.population : 0;
        });
        return Math.floor(ret);
    };
    
    Game.prototype.withinVertBounds = function(pos) {
        return 0 <= pos.y && pos.y <= this.getDims().y;
    };
    Game.prototype.withinHorzBounds = function(pos) {
        return 0 <= pos.x && pos.x <= this.getDims().x;
    };

    function clamp(src,low,high) {
        src = Math.max(src,low);
        src = Math.min(src,high);
        return src;
    }
    function clampVec(src,low,high) {
        var ret = new Coord();
        ret.x = clamp(src.x,low,high);
        ret.y = clamp(src.y,low,high);
        return ret;
    }
    
    Game.prototype.movingInBounds = function(pos,dir) {
        var valid = this.inBounds(pos);
        if(!valid) {
            if(this.withinHorzBounds(pos)) {
                valid = dir.y > 0 && pos.y < 0 ||
                        dir.y < 0 && pos.y > 0;
            } else if(this.withinVertBounds(pos)) {
                valid = dir.x > 0 && pos.x < 0 ||
                        dir.x < 0 && pos.x > 0;
            } else {
                //get nearestCorner
                var nearestCornerPos;
                var corners = [new Coord(0,0), new Coord(this.getDims().x,0),new Coord(0,this.getDims().y),new Coord(this.getDims())];
                nearestCornerPos = SingleSelect(corners,function(a,b) {
                    return pos.sub(a).lengthSquared() < pos.sub(b).lengthSquared() ? a : b;
                });
                //complete
                var diff = clampVec(nearestCornerPos.sub(pos),-1,1);
                return diff.isEqual(clampVec(dir,-1,1));
            }
        }
        return valid;
    };
    
    Game.prototype.getHazardAt = function(x,y) {
        var pos = y === undefined ? x : new Coord(x,y);
        var ret = [];
        this.trackedHazards.foreachInSet(function(item) {
            if(item.pos.isEqual(pos)) {
                ret.push(item);
            }
        });
        return ret;
    };
    Game.prototype.HazardAt = function(x,y) {
        return this.getHazardAt(x,y).length > 0;
    };
    Game.prototype.AllObjectsAt = function(x,y) {
        var pos = y === undefined ? x : new Coord(x,y);
        var ret = [];
        this.trackedHazards.foreachInSet(function(item) {
            if(item.pos.isEqual(pos)) {
                ret.push(item);
            }
        });
        this.spawners.map(function(item) {
            if(item.pos.isEqual(pos)) {
                ret.push(item);
            }
        });
        var cell = this.getCell(x,y);
        if(cell !== null && cell.item !== null) {
            ret.push(cell.item);
        }
        return ret;
    };
    
    Game.prototype.update = function() {
        var potato = this;
        this.trackedHazards.foreachInSet(function(item) {
            var oldPos = item.pos;
            item.pos = item.pos.add(item.direction);
            potato.hazardMovedEvent.callAll(oldPos,item.pos,item);
            var cell = potato.getCell(item.pos);
            if(cell !== null && cell.item !== null && cell.item.type === ItemType.Housing) {
                //hazard beats item
                var changed = false;
                while(!potato.cheats && item.getLevel() > 0 && cell.item.getLevel() > 0) {
                    item.decreaseLevel();
                    item.decreaseLevel();
                    cell.item.decreaseLevel();
                    changed = true;
                }
                if(changed) {
                    var oldItem = cell.item;
                    if(cell.item.getLevel() <= 0) {
                        cell.item = null;
                    }
                    potato.itemChangedEvent.callAll(cell.pos,oldItem,cell.item);
                    potato.itemLostLevels.callAll(cell.pos,oldItem,cell.item,item);
                }
            }
            item.decreaseLevel();
            if(item.getLevel() <= 0 || !potato.movingInBounds(item.pos,item.direction)) {
                potato.hazardRemovedEvent.callAll(item.pos,item);
                potato.removeHazard(item);
            }
        });
        this.spawners.map(function(item) {
            var newHazard = item.updateTurns();
            if(newHazard !== null) {
                potato.addHazard(newHazard);
                potato.hazardSpawnedEvent.callAll(newHazard.pos,newHazard);
            }
        });
    };
    
    return Game;
}());




//endregion

//region Ticker
//message ticker


//make a pool of possible message to poll from when Q is empty

var MessageTicker = (function(){
    function MessageTicker() {
        this.characterQ = [];
        this.dilimiter = " ";
    }
    MessageTicker.prototype.addMessage = function(stringMsg) {
        var i;
        for(i = 0;i<stringMsg.length;i++) {
            this.characterQ.push(stringMsg.charAt(i));
        }
        for(i = 0;i<this.dilimiter.length;i++) {
            this.characterQ.push(stringMsg.charAt(i));
        }
    };
    MessageTicker.prototype.getString = function(length) {
        length = length || 100;
        var ret = "";
        for(var i = 0;i<length && i< this.characterQ.length;i++) {
            ret += this.characterQ[i];
        }
    };
    MessageTicker.prototype.update = function() {
        if(this.characterQ.length > 0) {
            this.characterQ.shift();
        }
    };
}());
//endregion
//endregion

//region HUDOBJECT
var allGraphic = [];
var numWorlds = 1;
var numStatics = 2;
var numElements = 6;
var numHazards = 2;
var staticBuf = numWorlds;
var elementBuf = numWorlds+numStatics;
var spawnerBuf = numWorlds+numStatics+numElements;
var hazardBuf = numWorlds+numStatics+numElements+numHazards;

function Square(pos,dim){
    this.pos = pos;
    this.dim = dim;
    this.misc = 0;
    
    this.changeItem = function(container,newIndex) {
        
        this.fill(container,newIndex);
    };
    this.fill = function(container,index){
        if(index!==0)
        {
            container.removeChild(this.graphic);
            this.graphic = allGraphic[index].clone();
            this.graphic.x = this.pos.x;
            this.graphic.y = this.pos.y+this.dim.y;
            this.graphic.scaleX=this.dim.x/128;
            this.graphic.scaleY=0.2;
            createjs.Tween.get(this.graphic,{loop:false})
                .to({y:this.pos.y-this.dim.y*0.40, scaleY:this.dim.y/96},100,createjs.Ease.linear)
                .to({y:this.pos.y, scaleY:this.dim.y/128},100,createjs.Ease.linear);
            container.addChild(this.graphic);
            this.misc = 1;
        }
        else if(this.graphic){
            this.misc = 0;
            createjs.Tween.get(this.graphic,{loop:false})
                .to({y:this.pos.y-this.dim.y*0.40, scaleY:this.dim.y/96},100,createjs.Ease.linear)
                .to({y:this.pos.y+this.dim.y, scaleY:0.2},100,createjs.Ease.linear)
                .call(this.animHelper);
        }
        else {
            this.graphic = allGraphic[index].clone();
            this.graphic.x = this.pos.x;
            this.graphic.y = this.pos.y;
            this.graphic.scaleX=this.dim.x/128;
            this.graphic.scaleY=this.dim.y/128;  
            container.addChild(this.graphic);
        }
    };
    this.destruct = function(container){
        this.pos=0;
        this.dim=0;
        this.misc=0;
        container.removeChild(this.graphic);
        this.graphic=null;
    };
    var spud = this;
    this.animHelper = function(){
        GameStates.Game.container.removeChild(spud.graphic);
        spud.graphic = allGraphic[0].clone();
        spud.graphic.x = spud.pos.x;
        spud.graphic.y = spud.pos.y;
        spud.graphic.scaleX=spud.dim.x/128;
        spud.graphic.scaleY=spud.dim.y/128;
        GameStates.Game.container.addChild(spud.graphic);
    };
}

function Agent(container,coords,pos,dim,type,lifespan){
    this.pos = pos;
    this.coords = coords;
    this.dim = dim;
    this.type = type;
    this.lifespan = lifespan;
    if(levels[currentLevel].game.cheats){
        this.graphic = loadImage("jamie");
    }
    else{
        this.graphic = allGraphic[type+hazardBuf].clone();
    }
    this.graphic.x = this.pos.x;
    this.graphic.y = this.pos.y;
    this.graphic.scaleX = this.dim.x/128;
    this.graphic.scaleY = this.dim.y/128;
    this.offset = 0;
    container.addChild(this.graphic);
    
    this.move = function(newCoords,newPos,newAge){
        this.coords =newCoords;
        this.age(newAge);
        
        var moveTween = createjs.Tween.get(this.graphic,{loop:false})
            .to({x: newPos.x+this.offset, y:newPos.y+this.offset, scaleX:(this.dim.x/128)*(newAge/this.lifespan), scaleY:(this.dim.y/128)*(newAge/this.lifespan) },250,createjs.Ease.linear).call(refresher);
    };
    
    this.destruct = function(container){
        var moveTween = createjs.Tween.get(this.graphic,{loop:false})
                .to({y:this.pos.y-this.dim.y*0.40, scaleY:this.dim.y/96},100,createjs.Ease.linear)
                .to({y:this.pos.y+this.dim.y, scaleY:0.2},100,createjs.Ease.linear)
                .call(this.reallydestruct);
    };
    var yahrgh = this;
    this.reallydestruct = function(){
        GameStates.Game.container.removeChild(yahrgh.graphic);
        yahrgh.graphic=null;
    };
    
    this.age = function(newAge){
        //this.graphic.scaleX = (this.dim.x/128)*(newAge/this.lifespan);
        //this.graphic.scaleY = (this.dim.y/128)*(newAge/this.lifespan);
        this.offset = (this.dim.x/2)*(1-(newAge/this.lifespan));
        //this.graphic.x += this.offset;
        //this.graphic.y += this.offset;
    };
}

function Grid(container, cells, pos, dim){
    this.dim = dim;
    this.pos = pos;
    this.cells = cells;
    this.agents = new HashMap();
    this.squares = [];
    for(var i=0; i<cells.x; i++){
        this.squares[i] = [];
        for(var j=0; j<cells.y; j++){
            var spos = new Coord(i*(dim.x/cells.x)+pos.x,j*(dim.y/cells.y)+pos.y);
            var sdim = new Coord(dim.x/cells.x,dim.y/cells.y);
            this.squares[i][j] = new Square(spos,sdim);
            this.squares[i][j].fill(container,0);
        }
    }
    
    this.highlight = function(x,y) {
        
    };
    
    this.placeElement = function(container,i,lev){
        this.squares[i.x][i.y].changeItem(container,lev+elementBuf); // asdfasdf
    };
    
    this.placeStatic = function(container,i,type){
        this.squares[i.x][i.y].changeItem(container,type+staticBuf);
        this.squares[i.x][i.y].misc=-1;
    };
    this.hasStatic = function(i){
        return this.squares[i.x][i.y].misc==-1;
    };
    
    this.placeSpawner = function(container,i,haz){
        if(haz>=numHazards)haz = Math.floor(Math.random()*2+1)-1;
        this.squares[i.x][i.y].changeItem(container,haz+spawnerBuf);
        this.squares[i.x][i.y].misc=haz+1;
    };
    this.getHazardType = function(i){
        return this.squares[i.x][i.y].misc-1;
    };
    
    this.clear = function(container,i){
        this.squares[i.x][i.y].changeItem(container,0);
        if(this.squares[i.x][i.y].misc!==0){this.squares[i.x][i.y].misc=0;}
        this.refresh(container);
    };
    this.spawnHazard = function(container,i,haz,realHaz){
        var spos = new Coord(i.x*(dim.x/cells.x)+pos.x,i.y*(dim.y/cells.y)+pos.y);
        var sdim = new Coord(dim.x/cells.x,dim.y/cells.y);
        this.agents.add(realHaz,new Agent(container,i,spos,sdim,haz,realHaz.level));
    };
    this.moveHazard = function(hazard,newPos){
        var spos = new Coord(newPos.x*(dim.x/cells.x)+pos.x,newPos.y*(dim.y/cells.y)+pos.y);
        var agent = this.agents.get(hazard);
        agent.move(newPos,spos,hazard.level);
    };
    this.removeHazard = function(container,haz){
        var agent = this.agents.get(haz);
        agent.destruct(container);
        this.agents.remove(haz);
    };
    
    this.randomStatic = function(container,amount){
        for(var i=0; i<amount; i++){
            var rx = Math.floor(Math.random() * this.cells.x);
            var ry = Math.floor(Math.random() * this.cells.y);
            var rtype = Math.floor(Math.random() * numStatics);
            this.placeStatic(container,new Coord(rx,ry),rtype);
            
        }
    };
    this.destruct = function(container){
        for(var i=0; i<cells.x; i++){
            for(var j=0; j<cells.y; j++){
                this.squares[i][j].destruct(container);
                this.squares[i][j] = null;
            }
        }
        this.agents.foreachInSet(function(key,val) {
            if(val !== null) {
                val.destruct(container);
            }
        });
    };
    this.refresh = function(container){
        this.agents.foreachInSet(function(key,val) {
            container.removeChild(val.graphic);
            container.addChild(val.graphic);
        });
    };
    this.anyOpen = function(){
        for(var i=0; i<cells.x; i++){
            for(var j=0; j<cells.y; j++){
                if(this.squares[i][j].misc===0)return true;
            }
        }
        return false;
    };
}

function refresher(){
    levels[currentLevel].grid.refresh(GameStates.Game.container);
}


function updateStars(ratio){ 
    stars[0].gotoAndStop("empty");
    stars[1].gotoAndStop("empty");
    stars[2].gotoAndStop("empty");
    if(ratio>0.125)stars[0].gotoAndStop("quarter");
    if(ratio>0.25 )stars[0].gotoAndStop("half");
    if(ratio>0.375)stars[0].gotoAndStop("quarter3");
    if(ratio>0.5  )stars[0].gotoAndStop("full");
    if(ratio>0.625)stars[1].gotoAndStop("quarter");
    if(ratio>0.75 )stars[1].gotoAndStop("half");
    if(ratio>0.875)stars[1].gotoAndStop("quarter3");
    if(ratio>1.0  )stars[1].gotoAndStop("full");
    if(ratio>1.125)stars[2].gotoAndStop("quarter");
    if(ratio>1.25 )stars[2].gotoAndStop("half");
    if(ratio>1.375)stars[2].gotoAndStop("quarter3");
    if(ratio>1.5  )stars[2].gotoAndStop("full");
}

//endregion

//region GAME
var currentLevel = 0;
var levels = [];
var titleText;
var pauseButton;
var QueueContainer = [];
var QueueBorder = [];
var elementQueue = [];
var turnsLabel;
var turnsText;
var pop;
var goal;
var rightBar;
var rightBarBorder;
var topBar;
var topBarBorder;
var bottomBar;
var bottomBarBorder;
var leftBar;
var stars = [];
var victory;
var paused = false;
var jamieText;

function Level(title,world,turns,goalamount,gameSize,numStatic){
    this.world = world;
    this.title = title;
    this.turns = turns;
    this.goalAmount = goalamount;
    this.gameSize = gameSize;
    this.numStatic = numStatic;
    
    this.enable = function(container){
        if(this.world==1){
            allGraphic[0] = loadImage("purPath");
            allGraphic[1] = loadImage("purTree");
            allGraphic[2] = loadImage("purRock");
            allGraphic[3] = loadImage("bolt");
            allGraphic[4] = loadImage("purPop1");
            allGraphic[5] = loadImage("purPop2");
            allGraphic[6] = loadImage("purPop3");
            allGraphic[7] = loadImage("purPop4");
            allGraphic[8] = loadImage("purPop5");
            allGraphic[9] = loadImage("mantisSpawn");
            allGraphic[10] = loadImage("fireSpawn");
            allGraphic[11] = loadImage("mantis");
            allGraphic[12] = loadImage("fire");
            this.background = loadImage("purBackground");
            container.addChild(this.background);
        }
        else if(this.world==2){
            allGraphic[0] = loadImage("bluPath");
            allGraphic[1] = loadImage("bluTree");
            allGraphic[2] = loadImage("bluRock");
            allGraphic[3] = loadImage("bolt");
            allGraphic[4] = loadImage("bluPop1");
            allGraphic[5] = loadImage("bluPop2");
            allGraphic[6] = loadImage("bluPop3");
            allGraphic[7] = loadImage("bluPop4");
            allGraphic[8] = loadImage("bluPop5");
            allGraphic[9] = loadImage("creeperSpawn");
            allGraphic[10] = loadImage("tsunamiSpawn");
            allGraphic[11] = loadImage("creeper");
            allGraphic[12] = loadImage("tsunami");
            this.background = loadImage("bluBackground");
            container.addChild(this.background);
        }
        this.game = new Game(this.gameSize);
        this.game.turns = this.turns;
        var pineapple = this;
        this.game.itemQChangedEvent.addCallBack(function(e){
            e = e;
            pineapple.updateQueue(container);
        });
        this.game.populationChangedEvent.addCallBack(function(e){
            e=e;
            var popul = pineapple.game.getPopulation();
            pop.text = "Pop " + popul;
            updateStars(popul/pineapple.goalAmount);
            score = popul;
        });
        this.game.itemChangedEvent.addCallBack(function(pos,oldItem,newItem){
            if(newItem!==null){
                var level = newItem.getLevel();
                if(level>5)level=5;
                if(level<1)level=1;
                pineapple.grid.placeElement(container,pos,level);
            }
            else {pineapple.grid.clear(container,pos);}
        });
        this.game.hazardSpawnedEvent.addCallBack(function(pos,hazard){
            pineapple.grid.spawnHazard(container,pos,pineapple.grid.getHazardType(pos),hazard);
        });
        this.game.hazardMovedEvent.addCallBack(function(oldPos,newPos,hazard){
            pineapple.grid.moveHazard(hazard,newPos);
        });
        this.game.hazardRemovedEvent.addCallBack(function(pos,hazard){
            pineapple.grid.removeHazard(container,hazard); 
        });
        this.game.itemLostLevels.addCallBack(function(pos,old,newitem,hazard){
            var theType = pineapple.grid.agents.get(hazard).type;
            if(theType===0){
                if(pineapple.world==1)createjs.Sound.play("monster");
                else createjs.Sound.play("creep");
            }
            else if(theType==1){
                if(pineapple.world==1)createjs.Sound.play("fire");
                else createjs.Sound.play("wave");
            }
        });
        updateStars(0);
    };
    
    this.setSpawners = function(){};
    
    this.setupGrid = function(container){
        titleText.text = this.title;
        turnsText.text = this.game.getTurnCount();
        pop.text = "Pop: " + Math.floor(this.game.getPopulation());
        goal.text = " / "+ this.goalAmount;
        
        this.grid = new Grid(container, this.game.getDims(),new Coord(30,50),new Coord(500,500));
        
        this.grid.randomStatic(container,this.numStatic);
        
        for(var i=0; i<this.game.spawners.length; i++){
            if(this.game.spawners[i].pos.withinBox(this.game.getDims())){
                this.grid.placeSpawner(container,this.game.spawners[i].pos,i);   
            }
        }
    };
    
    this.updateQueue = function(container){
        var mod=1;
        for(var i=3; i>=0; i--){
            container.removeChild(elementQueue[i]);
            if(i===0){mod=2;}
            var lev = this.game.itemQ(i).getLevel();
            if(lev>5){lev=5;}
            elementQueue[i] = allGraphic[lev+elementBuf].clone();
            elementQueue[i].x = 675-25*mod;
            elementQueue[i].y = 550-60*(3-i)-50*mod;
            elementQueue[i].scaleX = 50*mod/128;
            elementQueue[i].scaleY = 50*mod/128;
            container.addChild(elementQueue[i]);
        }
    };
    
    this.place = function(container){
        if(mouse.pos.sub(this.grid.pos).withinBox(this.grid.dim)&&!paused){
            var index = mouse.pos.sub(this.grid.pos).div(this.grid.dim.x/this.grid.cells.x);
            var flooredIndex = index.floor();
            var queryInfo = this.game.QueryMove(flooredIndex,this.game.itemQ(0));
            
            if(this.game.itemQ(0).type==ItemType.BlackHole){
                if(this.game.HazardAt(flooredIndex)){
                    this.game.ApplyMove(flooredIndex,this.game.popFromQ(),queryInfo);
                    createjs.Sound.play("kabang");
                }
                else if(queryInfo.alreadyOccupied||this.grid.hasStatic(flooredIndex)){                         
                    this.grid.clear(container,flooredIndex);
                    this.game.ApplyMove(flooredIndex,this.game.popFromQ(),queryInfo);
                    createjs.Sound.play("kabang");
                }
                else{
                    this.game.popFromQ();
                    createjs.Sound.play("fizzle");
                }
                
            }
            else if(this.grid.getHazardType(flooredIndex)==-1){
                this.game.ApplyMove(flooredIndex,this.game.popFromQ(),queryInfo);
                if(queryInfo.cells.length>1) createjs.Sound.play("kaching");
                else createjs.Sound.play("tick");
            }
            if(!this.grid.anyOpen())this.game.turns=0;
        }   
    };
    
    this.update = function(){
        keyToggles.map(function(item) { item.update();});
        var currentTurns = this.game.getTurnCount();
        if(currentTurns>500){
            turnsText.text="INF";
            this.game.turns=900;
            goal.text = "";
        }
        else{
            turnsText.text=currentTurns;
        }
        if(this.game.getTurnCount()===0){
            if(this.game.getPopulation()<this.goalAmount){
                if(this.world==1){
                    GameStates.GameOver.container.addChild(loadImage("purGameover"));
                }
                else if(this.world==2){
                    GameStates.GameOver.container.addChild(loadImage("bluGameover"));
                }
                victory=false;
            }
            else{
                if(this.world==1){
                    GameStates.GameOver.container.addChild(loadImage("purWin"));
                }
                else if(this.world==2){
                    GameStates.GameOver.container.addChild(loadImage("bluWin"));
                }
                victory=true;
            }
            CurrentGameState=GameStates.GameOver;
        }  
    };
    
    this.disable = function(container){
        container.removeChild(this.background);
        this.grid.destruct(container);
        this.game = null;
    };
}

function initGameScene(container) {
//region UI init
    
    leftBar = new createjs.Shape();
    leftBar.graphics.beginFill("#333").drawRect(0,0,5,600);
    
    rightBar = new createjs.Shape();
    rightBar.graphics.beginFill("#AAA").drawRect(565,5,230,590);
    rightBar.alpha = 0.5;
    rightBarBorder = new createjs.Shape();
    rightBarBorder.graphics.setStrokeStyle(5,"round").beginStroke("#333").drawRect(565,5,230,590);
    
    topBar = new createjs.Shape();
    topBar.graphics.beginFill("#AAA").drawRect(5,5,560,30);
    topBar.alpha = 0.5;
    topBarBorder = new createjs.Shape();
    topBarBorder.graphics.setStrokeStyle(5,"round").beginStroke("#333").drawRect(2,2,560,34);
    
    bottomBar = new createjs.Shape();
    bottomBar.graphics.beginFill("#AAA").drawRect(5,565,560,30);
    bottomBar.alpha = 0.5;
    bottomBarBorder = new createjs.Shape();
    bottomBarBorder.graphics.setStrokeStyle(5,"round").beginStroke("#333").drawRect(2,563,560,34);
    
    QueueBorder[0] = new createjs.Shape();
    QueueBorder[0].graphics.setStrokeStyle(5,"round").beginStroke("#333").drawRect(620,265,110,110);
    QueueContainer[0] = new createjs.Shape();
    QueueContainer[0].graphics.beginFill("#AAA").drawRect(625,270,100,100);
    QueueContainer[0].alpha = 0.5;
    
    for(var i=1; i<4; i++){
        QueueBorder[i] = new createjs.Shape();
        QueueBorder[i].graphics.setStrokeStyle(5,"round").beginStroke("#333").drawRect(645,320+60*i-5,60,60);
        QueueContainer[i] = new createjs.Shape();
        QueueContainer[i].graphics.beginFill("#AAA").drawRect(650,320+60*i,50,50);
        QueueContainer[i].alpha= 0.5;
    }
    
    for(i=0; i<3; i++){
        stars[i] = spriteSheets.makeStar();
        stars[i].x = 615+i*60;
        stars[i].y = 220-20*(i%2);
        stars[i].scaleX = 0.6+0.2*(i%2);
        stars[i].scaleY = 0.6+0.2*(i%2);
    }
    
    turnsLabel = new createjs.Text("Turns: ", "italic 20px Orbitron", "#FFF");
    turnsLabel.x = 580;
    turnsLabel.y = 60; 
    
    turnsText = new createjs.Text("", "italic 64px Orbitron", "#FFF");
    turnsText.x = 660;
    turnsText.y = 15; 
    
    pop = new createjs.Text("", "24px Quantico", "#FFF");
    pop.x = 600;
    pop.y = 100;
    
    goal = new createjs.Text("", "24px Quantico", "#FFF");
    goal.x = 700;
    goal.y = 100; 
    
    titleText = new createjs.Text("", "24px Quantico", "#FFF");
    titleText.x = 250;
    titleText.y = 2;
    
    jamieText = new createjs.Text("Jamie Mode Activated! Hazards are Harmless!", "24px Quantico", "#FFF");
    jamieText.x = 20;
    jamieText.y = 562;
    
    pauseButton = CreateButtonFromSprite(spriteSheets.makeMiniButton(),"miniMenu",    function() { 
            paused = true;
            var subMenu = loadImage("pauseMenu");
            var pausedText = new createjs.Text("Paused", "italic 60px Orbitron", "#FFF");
            pausedText.x = 270;
            pausedText.y = 150; 
            container.addChild(subMenu);
            container.addChild(pausedText);
            var mbtn = [];
            mbtn.push(CreateButtonFromSprite(spriteSheets.makeMiniButton(),"miniBack",    function() {
                paused = false;
                createjs.Sound.play("tick");
                mbtn.map(function(item) {
                    container.removeChild(item);
                });
                container.removeChild(subMenu);
                container.removeChild(pausedText);
            }));
            mbtn[0].x=400;
            mbtn[0].y=350;
            mbtn.push(CreateButtonFromSprite(spriteSheets.makeMiniButton(),"miniQuit",    function() {
                paused = false;
                createjs.Sound.play("tick");
                mbtn.map(function(item) {
                    container.removeChild(item);
                });
                container.removeChild(subMenu);
                container.removeChild(pausedText);
                CurrentGameState = GameStates.StartScreen;
            }));
            mbtn[1].x=400;
            mbtn[1].y=400;
            mbtn.push(CreateButtonFromSprite(spriteSheets.makeMiniButton(),"miniRetry",    function() {
                paused = false;
                createjs.Sound.play("tick");
                mbtn.map(function(item) {
                    container.removeChild(item);
                });
                container.removeChild(subMenu);
                container.removeChild(pausedText);
                GameStates.Game.disable();
                GameStates.Game.enable();
            }));
            mbtn[2].x=400;
            mbtn[2].y=300;
            mbtn.map(function(item) {
                container.addChild(item);
            });
            createjs.Sound.play("tick");
        });
    pauseButton.x = 75;
    pauseButton.y = 22;
    
    levels[0] = new Level("Meet the Tribbles", 1 , 18, 30, new Coord(3,3),0);
    
    levels[1] = new Level("Annoying Neighbors", 1 , 30, 60, new Coord(4,4),5);
    
    levels[2] = new Level("Copyright Infringement", 2 , 50, 80, new Coord(5,5),0);
    levels[2].setSpawners = function(){
        var toAdd = new Spawner(5,8,2,3);
        toAdd.pos = new Coord(2,2);
        for(var x=-1;x<2;x++) {
            for(var y=-1;y<2;y++) {
                if(x !== 0 && y !== 0) {
                    toAdd.directions.push(new Coord(x,y));
                }
            }
        }
        levels[2].game.addSpawner(toAdd);
    };
    levels[3] = new Level("A Real Game", 1 , 45, 80, new Coord(5,5),4);
    levels[3].setSpawners = function(){
        var toAdd = new Spawner(5,8,5,7);
        toAdd.pos = new Coord(1,4);
        toAdd.directions.push(new Coord(0,-1));
        toAdd.directions.push(new Coord(0,-1));
        toAdd.directions.push(new Coord(1, 0));
        toAdd.directions.push(new Coord(1,-1));
        toAdd.directions.push(new Coord(1,-1));
        levels[3].game.addSpawner(toAdd);
        
        toAdd = new Spawner(1,2,3,4);
        toAdd.pos = new Coord(0,0);
        toAdd.directions.push(new Coord(0,1));
        toAdd.directions.push(new Coord(0,1));
        toAdd.directions.push(new Coord(1,1));
        toAdd.directions.push(new Coord(1,0));
        toAdd.directions.push(new Coord(1,0));
        levels[3].game.addSpawner(toAdd);
    };
    levels[4] = new Level("Die Already", 2 ,999, 999, new Coord(6,6),2);
    levels[4].setSpawners = function(){
        var posToSpawnAt = [new Coord(4,4), new Coord(1,4), new Coord(4,1), new Coord(1,1)];
        posToSpawnAt.map(function(item) {
            var toAdd = new Spawner(1,2,3,4);
            toAdd.pos = item;
            for(var x=-1;x<2;x++) {
                for(var y=-1;y<2;y++) {
                    if(x !== 0 && y !== 0) {
                        toAdd.directions.push(new Coord(x,y));
                    }
                }
            }
            levels[4].game.addSpawner(toAdd);
        });
    };
    
//endregion
    
    GameStates.Game.enable = function() {
        backgroundMusic.setSoundFromString("GamePlay",true);
        levels[currentLevel].enable(container);
        levels[currentLevel].setSpawners();
        levels[currentLevel].setupGrid(container);
        
        container.addChild(leftBar);
        container.addChild(topBarBorder);
        container.addChild(topBar);
        container.addChild(bottomBarBorder);
        container.addChild(bottomBar);
        container.addChild(rightBarBorder);
        container.addChild(rightBar);
        container.addChild(turnsLabel);
        container.addChild(pauseButton);
        container.addChild(titleText);
        
        for(var i=0; i<4; i++){
            container.addChild(QueueBorder[i]);   
            container.addChild(QueueContainer[i]);   
        }
        
        container.addChild(stars[0]);
        container.addChild(stars[1]);
        container.addChild(stars[2]);
        
        container.addChild(turnsText);
        container.addChild(pop);
        container.addChild(goal);
        
        levels[currentLevel].updateQueue(container);
    };
    
    GameStates.Game.mouseDownEvent = function(e){
        e=e;
        
    };
    
    GameStates.Game.mouseUpEvent = function(e){
        e=e;
        levels[currentLevel].place(container);
    };
    
    GameStates.Game.update = function() {
        levels[currentLevel].update();
        
    };
    
    GameStates.Game.disable = function() {
        levels[currentLevel].disable(container);
        container.removeChild(leftBar);
        container.removeChild(topBarBorder);
        container.removeChild(topBar);
        container.removeChild(bottomBarBorder);
        container.removeChild(bottomBar);
        container.removeChild(rightBarBorder);
        container.removeChild(rightBar);
        container.removeChild(turnsLabel);
        container.removeChild(pauseButton);
        container.removeChild(titleText);
        
        for(var i=0; i<4; i++){
            container.removeChild(QueueBorder[i]);   
            container.removeChild(QueueContainer[i]);
            container.removeChild(elementQueue[i]);
        }
        
        container.removeChild(stars[0]);
        container.removeChild(stars[1]);
        container.removeChild(stars[2]);
        container.removeChild(turnsText);
        container.removeChild(pop);
        container.removeChild(goal);
    };
}
//endregion





var keyToggles = [];


var cheat = new KeyStateManager('J');
cheat.onClick = function() {
    if(!levels[currentLevel].game.cheats){
        backgroundMusic.setSoundFromString("Friday",true);
        levels[currentLevel].game.cheats = true;
        GameStates.Game.container.addChild(jamieText);
    }
    else{
        backgroundMusic.setSoundFromString("GamePlay",true);
        levels[currentLevel].game.cheats = false;  
        GameStates.Game.container.removeChild(jamieText);
    }
};

keyToggles.push(cheat);


//place this in an update
//keyToggles.map(function(item) { item.update();});
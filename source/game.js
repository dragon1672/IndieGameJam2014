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
        Locker : new GameState("Locker"),
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
        Coord.prototype.clone    = function() { return new Coord(this); };
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
    
    var Bounds = (function(){
        function Bounds(points,set2) {
            points = points || new Coord(0,0);
            set2 = set2 || new Coord(1,1);
            
            var allPoints = new HashSet();
            if(points instanceof Array) {
                points.addAll(points);
            } else {
                points.add(points);
            }
            if(set2 instanceof Array) {
                set2.addAll(points);
            } else {
                points.add(set2);
            }
            
            
            this.start = new Coord(null,null);
            this.end = new Coord(null,null);
            var instance = this;
            allPoints.map(function(item) {
                console.log(item);
                instance.start.x = instance.start.x === null ? item.x : Math.min(instance.start.x,item.x);
                instance.start.y = instance.start.y === null ? item.y : Math.min(instance.start.y,item.y);
                instance.end.x   = instance.end.x   === null ? item.x : Math.max(instance.end.x,item.x);
                instance.end.y   = instance.end.y   === null ? item.y : Math.max(instance.end.y,item.y);
            });
        }
        Bounds.prototype.withinBounds = function(pos) {
            var zeroBased = pos.sub(this.start);
            var offset = this.end.sub(this.start);
            return pos.withinBox(offset);
        };
        
        return Bounds;
    }());
    
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
        function HashSet(array) {
            this.myTable = new HashTable();
            if(array instanceof Array) {
                this.addAll(array);
            }
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
    function stackButtons(buttons, padding, x,y) {
        var bottomPos = y === undefined ? x : (x || new Coord(stage.canvas.width/2,padding));
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
    function Unique(array) {
        var set = new HashSet();
        set.addAll(array);
        return set.toList();
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
    function Max(array, numToCompare) { numToCompare = numToCompare || function(a) { return a; }; return SingleSelect(array,function(a,b) { return numToCompare(a) > numToCompare(b) ? a : b; }); }
    function Min(array, numToCompare) { numToCompare = numToCompare || function(a) { return a; }; return SingleSelect(array,function(a,b) { return numToCompare(a) < numToCompare(b) ? a : b; }); }
    function Sum(array, numToCompare) { return SingleSelect(array,function(a,b) { return a + b; }); }
    function Select(array,selector) {
        selector = selector || function(item) { return item; };
        var ret = [];
        array.map(function(item) { ret.push(selector(item));});
        return ret;
    }
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
    function round(num,perc) {
        var pow = 1;
        for(var i=0;i<perc;i++) pow *= 10;
        num = Math.round(num * pow) / pow;
        return num;
    }
//endregion

//region loading files
var manifest = [
    {src:"audio/Loading.mp3", id:"Loading"},
    {src:"images/Static/Title.png", id:"title"},
    {src:"images/Static/locker.png", id:"locker"}, // asdfadsf
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
        if(canvas) {
            canvas.width = 800;
            canvas.height = 600;
            stage = new createjs.Stage(canvas);
            return true;
        }
        return false;
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
        if(setupCanvas()) {
            mouseInit();
            initLoadingScreen();
            registerGameLoop();

            loadFiles();
        }
    }
    
    if (!!(window.addEventListener)) {
        window.addEventListener("DOMContentLoaded", main);
    } else { // if IE
        window.attachEvent("onload", main);
    }
//endregion

//to be called after files have been loaded
function init() {
    GameStates.StartScreen.container.addChild(  loadImage("title")        );
    GameStates.Instructions.container.addChild( loadImage("instructions") );
    GameStates.Credits.container.addChild(      loadImage("credits") );
    GameStates.Credits.container.addChild(      loadImage("credits") );
    
    for(var propertyName in GameStates) {
        stage.addChild(GameStates[propertyName].container);
        GameStates[propertyName].masterDisable();
    }
    
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
        //display test and score
        //offer button to goto home
        GameStates.GameOver.enable = function() {
            
        };
        
        
        GameStates.GameOver.update = function() {
            
        };
        GameStates.GameOver.disable = function() {
            
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
        this.normalizedDir = this.dir.normalized();
        this.graphic = new createjs.Shape();
        this.graphic.graphics.beginFill("#FFF").drawCircle(0, 0, Rand(2,6));
        this.graphic.x = pos.x;
        this.graphic.y = pos.y;
        this.scale = Rand(0,maxScale);
    }
    circle.prototype.update = function() {
        this.pos = this.pos.add(this.dir);
        if(!this.pos.sub(this.normalizedDir.mul(this.scale)).withinBox(screenDims)) {
            this.pos = this.pos.wrapByBox(screenDims).add(this.normalizedDir.mul(this.scale));
        }
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
        circles.map(function(item) {
            item.update();
        });
    };
    stage.addChild(GameStates.Loading.container);
    CurrentGameState = GameStates.Loading;
}
//endregion

//region GAMEOBJECT

//region classes

//asdfasdf

var GradeTable = {
    data: [
        {letter:"A ", GPA: 4.0, low: 93.0, high: 100.0},
        {letter:"A-", GPA: 3.7, low: 90.0, high: 92.9 },
        {letter:"B+", GPA: 3.3, low: 87.1, high: 89.9 },
        {letter:"B ", GPA: 3.0, low: 83.0, high: 87.0 },
        {letter:"B-", GPA: 2.7, low: 80.0, high: 82.9 },
        {letter:"C+", GPA: 2.3, low: 77.1, high: 79.9 },
        {letter:"C ", GPA: 2.0, low: 73.0, high: 77.0 },
        {letter:"C-", GPA: 1.7, low: 70.0, high: 72.9 },
        {letter:"D+", GPA: 1.3, low: 67.1, high: 69.9 },
        {letter:"D ", GPA: 1.0, low: 60.0, high: 67.0 },
        {letter:"F ", GPA: 0.0, low: 0,    high: 59.9 }
    ],
    getFromPercent: function(percent) {
        return SingleSelect(GradeTable.data,function(a,b) {
            if(a !== null && a.low<=percent && percent <= a.high) return a;
            if(b !== null && b.low<=percent && percent <= b.high) return b;
            return null;
        });
    }
};

var Stats = (function(){
    function Stats() {
        this.cheatCount = 0;
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        this.timesCaught = 0;
        this.numOfTests = 0;
        this.stickersBought = 0;
        this.score = 0;
    }
    
    Stats.prototype.add = function(that) {
        var ret = new Stats();
        ret.cheatCount       += that.cheatCount      ;
        ret.correctAnswers   += that.correctAnswers  ;
        ret.incorrectAnswers += that.incorrectAnswers;
        ret.timesCaught      += that.timesCaught     ;
        ret.numOfTests       += that.numOfTests      ;
        ret.stickersBought   += that.stickersBought  ;
        // roll score as average
        ret.score = (this.score * this.numOfTests + that.score * that.numOfTests)  / ret.numOfTests; // ret numof tests should already be set
    };
    Stats.prototype.getScore = function() {
        return round(this.score , 3) * 100;
    };
    Stats.prototype.grade = function() {
        return GradeTable.getFromPercent(this.getScore());
    };
    
    return Stats;
}());

var BinaryMathOperation = (function(){
    function BinaryMathOperation(comboLogic, char) {
        this.comboLogic = comboLogic;
        this.char = char;
    }
    BinaryMathOperation.prototype.generatePair = function(rangeLow,rangeHigh) {
        return {
            a: Rand(rangeLow,rangeHigh),
            b: Rand(rangeLow,rangeHigh),
        };
    };
    
    return BinaryMathOperation;
}());

var DefaultMathOperations = (function(){
    var defaultMathOperations = {
        add: new BinaryMathOperation(function(a,b) { return a + b; },"+"),
        sub: new BinaryMathOperation(function(a,b) { return a - b; },"-"),
        mul: new BinaryMathOperation(function(a,b) { return a * b; },"*"),
        div: new BinaryMathOperation(function(a,b) { return a / b; },"/"),
    };
    defaultMathOperations.div.generatePair = function(rangeLow,rangeHigh) {
        var multTable = [];
        for(var i=rangeLow;i<=rangeHigh;i++) {
            multTable[i] = [];
            for(var j=rangeLow;j<=rangeHigh;j++) {
                multTable[i][j] = i * j;
            }
        }
        var ret = {
            a: null,
            b: Rand(rangeLow,rangeHigh),
        };
        ret.a = multTable[ret.b][Rand(rangeLow,rangeHigh)];
        return ret;
    };
    return defaultMathOperations;
}());


var Question = (function(){
    function Question(a,b,operation) {
        this.a = Math.max(a,b); // this prevents neg number on mul
        this.b = Math.min(b,a);
        this.operation = operation;
        this.correctAnswer = operation.comboLogic(this.a,this.b);
        this.userAnswer = null;
        this.text = new createjs.Text(this.a+" "+operation.char+" "+this.b+" = ", "italic 36px Orbitron", "#FFF");
    }
    return Question;
}());

var MathTest = (function(){
    function MathTest(listOfOperations,numOfQuestions, rangeLow, rangeHigh) {
        this.questions = [];
        this.listOfOperations = listOfOperations;
        this.numOfQuestions = numOfQuestions;
        this.rangeLow = rangeLow;
        this.rangeHigh = rangeHigh;
        this.stats = new Stats();
        this.caughtCheating = false;
        this.generate();
    }
    MathTest.prototype.generate = function() {
        this.questions = [];
        this.caughtCheating = false;
        this.stats.cheatCount = 0; // IMPORTANT: this will need to be updated during game play
        for(var i=0;i<this.numOfQuestions;i++) {
            var operation = RandomElement(this.listOfOperations);
            var pair = operation.generatePair(this.rangeLow,this.rangeHigh);
            this.questions.push(new Question(pair.a,pair.b,operation));
        }
        this.highestAnswer = Max(this.questions,function(a) { return a.correctAnswer; });
        this.lowestAnswer  = Min(this.questions,function(a) { return a.correctAnswer; });
    };
    //should be run after test is complete
    MathTest.prototype.updateStats = function() {
        this.stats.incorrectAnswers = 0;
        this.stats.correctAnswers = 0;
        this.stats.numOfTests = 1;
        this.stats.score = 0;
        var testInstance = this;
        this.questions.map(function(item) {
            if(item.correctAnswer === item.userAnswer) {
                testInstance.stats.correctAnswers++;
            } else {
                testInstance.stats.incorrectAnswers++;
            }
        });
        if(this.caughtCheating) {
            this.stats.timesCaught = 1;
        } else {
            this.stats.timesCaught = 0;
            this.stats.score = this.stats.correctAnswers / (this.stats.incorrectAnswers + this.stats.correctAnswers);
        }
    };
    
    return MathTest;
}());

var StockTests = [
    new MathTest([DefaultMathOperations.add],5,1,12),
    new MathTest([DefaultMathOperations.add,DefaultMathOperations.sub],5,1,12),
    new MathTest([DefaultMathOperations.add,DefaultMathOperations.sub,DefaultMathOperations.mul],5,1,12),
    new MathTest([DefaultMathOperations.add,DefaultMathOperations.sub,DefaultMathOperations.mul,DefaultMathOperations.div],5,1,12),
];

function getCheat(question, percentForCorrect) {
    var ret = question.correctAnswer;
    if(Math.random() > percentForCorrect) {
        var possibleAnswers = [];
        for(var i=-1;i<=1;i++) {
            for(var j=-1;j<=1;j++) {
                if(i!==0 && j!==0) {
                    possibleAnswers.push(question.operation.comboLogic(question.a+i,question.b+j));
                }
            }
        }
        possibleAnswers.push(question.correctAnswer+1);
        possibleAnswers.push(question.correctAnswer+2);
        possibleAnswers.push(question.correctAnswer-1);
        possibleAnswers.push(question.correctAnswer-2);
        possibleAnswers = Unique(Select(possibleAnswers,function(item) { return Math.max(0,Math.round(item)); }));
        ret = RandomElement(possibleAnswers);
    }
    return ret;
}


var Sticker = (function(){
    function Sticker() {
        this.isUnlocked = function() { return true; };
        this.desc = "";
        this.graphic = null;//new createjs.bitmap("");
        this.cost = 5;
        this.pos = new Vec2();
    }
    
    Sticker.prototype.clone = function() {
        var ret = new Sticker();
        
        ret.isUnlocked = this.isUnlocked;
        ret.desc = this.desc;
        ret.graphic = this.graphic.clone();
        ret.cost = this.cost;
        ret.pos = new Vec2(this.pos);
        
        return ret;
    };
    
    return Sticker;
}());

var allStickers = []; // set this somehow

var Locker = {
    myStickers: new HashSet(),
};

var globalStats = new Stats();

var lastTest = null;


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

//endregion

//endregion

//region HUDOBJECT


function initGameScene(container) {
    
    GameStates.Game.enable = function() {
        backgroundMusic.setSoundFromString("GamePlay",true);
        
    };
    
    GameStates.Game.mouseDownEvent = function(e){
        e=e;
        
    };
    
    GameStates.Game.mouseUpEvent = function(e){
        e=e;
    };
    
    GameStates.Game.update = function() {
        
    };
    
    GameStates.Game.disable = function() {
        
    };
}
function initLocker(container) {
    var validStickers = new HashSet();
    var newStickers = new HashSet();
    
    var stickerStuckToMouse = null;
    
    var lockerSpace = {
        start: new Coord(),
        end: new Coord(),
        withinBounds: function(pos) {
            var zeroBase = pos.sub(this.start);
            
        }
    };
    
    function StickerClicked(cloneOfSticker) {
        stickerStuckToMouse = cloneOfSticker;
    }
    
    allStickers.map(function(item) {
        item = new Sticker(); // asdf
        item.graphic.on("click",function() { StickerClicked(item.clone()); });
        //item.
        //item.
    });
    
    GameStates.Locker.enable = function() {
        backgroundMusic.setSoundFromString("GamePlay",true);
        
        //setup stickers
        var oldStickers = new HashSet(validStickers.toList());
        validStickers.addAll(Where(allStickers,function(item) { item.isUnlocked(globalStats); }));
        newStickers = validStickers.removeSet(oldStickers);
        
        
    };
    
    function tryPlaceSticker() {
        if(stickerStuckToMouse !== null) {
            //if valid then spot place and charge points update disabled stickers
            //if not ignore click
        }
    }
    
    GameStates.Locker.mouseDownEvent = function(e){
        e=e;
        tryPlaceSticker();
    };
    
    GameStates.Locker.mouseUpEvent = function(e){
        e=e;
        tryPlaceSticker();
    };
    
    GameStates.Locker.update = function() {
        if(stickerStuckToMouse !== null) {
            
        }
    };
    
    GameStates.Locker.disable = function() {
        
    };
}
//endregion


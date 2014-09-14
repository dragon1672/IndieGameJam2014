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
    //region hashy

    /*
     * Hash table developed by Anthony Corbin
    //*/
    var HashTable, HashMap;
     HashTable = HashMap = (function() {
        function HashTable() {
            this.pairs = [];
            this.numOfActiveIterations = 0;
            this._size = 0;
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
                this._size++;
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
            var hash;
            if (this.containsKey(key)) {
                hash = this.hashObject(key);
                this.pairs[hash].markedForDel = true;
                delete this.pairs[hash];
                this._size--;
            }
        };
        HashTable.prototype.containsKey = function (key) {
            var hash = this.hashObject(key);
            return (this.pairs[hash] && (this.pairs[hash] instanceof KeyValuePair)) ? true : false;
        };
        HashTable.prototype.containsValue = function (val) {
            var ret = false;
            this.map(function(key,mapVal) {
                ret = ret || mapVal === val;
            });
            return ret;
        };
        HashTable.prototype.isEmpty = function () { return this.size() === 0; };
        HashTable.prototype.size = function () {
            return this._size;
        };
        //pass in function(key,val)
        HashTable.prototype.foreachInSet = function (theirFunction) {
            this.numOfActiveIterations++;
            for(var i in this.pairs) {
                if(!this.pairs[i].markedForDel) {
                    theirFunction(this.pairs[i].key, this.pairs[i].val);
                }
            }
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
            var ret = new HashSet();
            this.map(function(item) {
                if(!that.contains(item)) {
                    ret.add(item);
                }
            });
            return ret;
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
    
    //region timers (requires hash and event)
    var StopWatch = (function(){
        function StopWatch() {
            this.gameTimer = 0;
            this.frameCount = 0;
        }
        StopWatch.prototype.update = function(FPS) {
            this.frameCount = Math.max(0,this.frameCount+1);
            // lets make this only count 1/10s of a second
            if(this.frameCount%(FPS/10) === 0) {
                this.gameTimer = this.frameCount/(FPS);   
            }
        };
        StopWatch.prototype.reset = function() {
            this.frameCount = 0;
            this.gameTimer = 0;
        };
        StopWatch.prototype.addSeconds = function(seconds, FPS) {
            this.frameCount += seconds * FPS;
        };
        return StopWatch;
    }());
    var Timer = (function(){
        function Timer() {
            this.startTime = 0;
            this.endTime = 0;
            this.lastInterval = 0;
        }
        Timer.prototype.start = function() {
            this.startTime = Date.now();
            this.lastInterval = this.startTime;
        };
        Timer.prototype.stop = function() {
            this.endTime = Date.now();
            return (this.endTime - this.startTime) / 1000;
        };
        Timer.prototype.interval = function() {
            var current = Date.now();
            var ret = (current - this.lastInterval) / 1000;
            this.lastInterval = current;
            return ret;
        };
        return Timer;
    }());
    var EventTimer = (function(){
        function EventTimer(targetFPS) {
            this.targetFPS = targetFPS || 30;
            this.timer = new Timer();
            this._updateHandle = null;
            //function(dt)
            this.updateEvent = new GameEvent();
        }
        EventTimer.prototype.update = function() {
            var dt = this.timer.interval();
            this.updateEvent.callAll(dt);
        };
        EventTimer.prototype.start = function() {
            this.stop();
            this.timer.start();
            var instance = this;
            this._updateHandle = setInterval(function() {instance.update();},1/this.targetFPS * 1000);
        };
        EventTimer.prototype.stop = function() {
            clearInterval(this._updateHandle);
            return this.timer.stop();
        };
        
        return EventTimer;
    }());
    var CountDownTimer = (function() {
        function CountDownTimer(time,loop) {
            this.startTime = time;
            this.time = time;
            this.timer = new EventTimer(30);
            var instance = this;
            this.timer.updateEvent.addCallBack(function(dt) {instance.update(dt);});
            this.loop = loop;
            
            //events
            //function(timer)
            this.timeCompleteEvent = new GameEvent();
            //function(timer)
            this.timeResetEvent = new GameEvent();
        }
        CountDownTimer.prototype.update = function(dt) {
            this.time -= dt;
            if(this.time < 0) {
                this.timeCompleteEvent.callAll(this);
                if(this.loop) {
                    this.time += this.startTime;
                    this.timeResetEvent.callAll(this);
                } else {
                    this.timer.stop();
                }
            }
        };
        CountDownTimer.prototype.start = function() {
            this.time = this.startTime;
            this.timer.start();
        };
        CountDownTimer.prototype.reset = CountDownTimer.prototype.start;
        CountDownTimer.prototype.stop = function() {
            this.timer.stop();
            return this.time;
        };
        CountDownTimer.prototype.getTimeLeft = function() {
            return this.time;
        };
        return CountDownTimer;
    }());
    //endregion
    
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
                allPoints.addAll(points);
            } else {
                allPoints.add(points);
            }
            if(set2 instanceof Array) {
                allPoints.addAll(set2);
            } else {
                allPoints.add(set2);
            }
            
            
            this.start = new Coord(null,null);
            this.end = new Coord(null,null);
            var instance = this;
            allPoints.map(function(item) {
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
        Bounds.prototype.wrapWithinBounds = function(pos) {
            var zeroBased = pos.sub(this.start);
            var offset = this.end.sub(this.start);
            return zeroBased.wrapByBox(offset).add(this.start);
        };
        Bounds.prototype.clampWithinBounds = function(pos) {
            var zeroBased = pos.sub(this.start);
            var offset = this.end.sub(this.start);
            zeroBased.x = clamp(zeroBased.x,0,offset.x);
            zeroBased.y = clamp(zeroBased.y,0,offset.y);
            return this.start.add(zeroBased);
        };
        Bounds.prototype.randomPointInside = function() {
            return new Vec2(
                Rand(this.start.x,this.end.x),
                Rand(this.start.y,this.end.y)
            );
        };
        
        return Bounds;
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
            onClickMethod = onClickMethod || function(){};
            button.gotoAndStop(title+"Up");
            button.on("click", function(e)    { createjs.Sound.play("tick"); onClickMethod(e);});
            button.on("mouseover", function() { createjs.Sound.play("tinyTick"); button.gotoAndStop(title+"Over"); });
            button.on("mouseout",  function() { button.gotoAndStop(title+"Up");   });
            button.on("pressup",   function() { button.gotoAndStop(title+"Up");   });
            button.on("mousedown", function() { button.gotoAndStop(title+"Down"); });
            return button;
        };
    }
    function CreateButtonFromSprite(btnPlay, title, onClickMethod) {
        generateRegButton(title)(btnPlay,onClickMethod);
        return btnPlay;
    }
    function prettyUpSeconds(secs, spacer) {
        spacer = spacer || " ";
        var breakup = [
            {val: 1,  suffix: ""},
            {val: 60, suffix: ":"},
            {val: 24, suffix: " days"},
            {val: 30, suffix: " months"},
            {val: 30, suffix: " years"},
            {val: 30, suffix: " decades"}
        ];
        var data = [Math.floor(secs)];
        var i = 0;
        while(data[i] >= breakup[i+1].val) {
            var temp  = data[i];
            data[i+1]   = Math.floor(data[i] / breakup[i+1].val);
            data[i] = temp - data[i+1] * breakup[i+1].val;//modlus
            i++;
        }
        var ret = "";
        var sep = "";
        for(i = data.length-1;i>=0;i--) {
            ret += sep+data[i] + breakup[i].suffix;
            sep = spacer;
        }
        return ret;
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
    function Sum(array) { return SingleSelect(array,function(a,b) { return a + b; }); }
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
    {src:"images/Static/locker.png", id:"locker"},
    {src:"images/Static/GameScene.png", id:"GameScene"},
    {src:"images/Static/Instructions.png", id:"instructions"},
    {src:"images/Static/GameOver.png", id:"GameOver"},
    {src:"images/Static/Credits.png", id:"credits"},
    {src:"audio/moralMathTheme.wav", id:"Failure"},
    {src:"audio/moralMathNeutral.wav", id:"GamePlay"},
    {src:"audio/moralMathPositive1.wav", id:"Pos1"},
    {src:"audio/moralMathPositive2.wav", id:"Pos2"},
    {src:"audio/moralMathNegative1.wav", id:"Neg1"},
    {src:"audio/moralMathNegative2.wav", id:"Neg2"},
    {src:"audio/PencilsDownYoung.wav", id:"PencilsDown"},
    {src:"images/buttons.png", id:"button"},
    {src:"images/miniButtons.png", id:"miniButton"},
    {src:"images/SpeakerOn.png", id:"SpeakerOn"},
    {src:"images/SpeakerOff.png", id:"SpeakerOff"},
    {src:"images/TeacherAnimation.png", id:"TeacherAnimation"},
    {src:"audio/TinyTick.mp3", id:"tinyTick"},
    {src:"audio/Tick.mp3", id:"tick"},
    {src:"audio/Kaching.mp3", id:"kaching"},
    {src:"audio/Fizzle.mp3", id:"fizzle"},
    {src:"audio/ForJamie.mp3", id:"Friday"},
    {src:"audio/moralMathTheme.wav", id:"StartScreen"},
    //all dem stickers
    {src:"images/stickers/bad/badSticker0.png", id:"badStick0"},
    {src:"images/stickers/bad/badSticker1.png", id:"badStick1"},
    {src:"images/stickers/bad/badSticker2.png", id:"badStick2"},
    {src:"images/stickers/bad/badSticker3.png", id:"badStick3"},
    {src:"images/stickers/bad/badSticker4.png", id:"badStick4"},
    {src:"images/stickers/bad/badSticker5.png", id:"badStick5"},
    {src:"images/stickers/bad/badSticker6.png", id:"badStick6"},
    {src:"images/stickers/bad/badSticker7.png", id:"badStick7"},
    {src:"images/stickers/bad/badSticker8.png", id:"badStick8"},
    //good
    {src:"images/stickers/good/goodSticker0.png",  id:"goodStick0" },
    {src:"images/stickers/good/goodSticker1.png",  id:"goodStick1" },
    {src:"images/stickers/good/goodSticker2.png",  id:"goodStick2" },
    {src:"images/stickers/good/goodSticker3.png",  id:"goodStick3" },
    {src:"images/stickers/good/goodSticker4.png",  id:"goodStick4" },
    {src:"images/stickers/good/goodSticker5.png",  id:"goodStick5" },
    {src:"images/stickers/good/goodSticker6.png",  id:"goodStick6" },
    {src:"images/stickers/good/goodSticker7.png",  id:"goodStick7" },
    {src:"images/stickers/good/goodSticker8.png",  id:"goodStick8" },
    {src:"images/stickers/good/goodSticker9.png",  id:"goodStick9" },
    {src:"images/stickers/good/goodSticker10.png", id:"goodStick10"},
    {src:"images/stickers/good/goodSticker11.png", id:"goodStick11"},
    {src:"images/stickers/good/goodSticker12.png", id:"goodStick12"},
    {src:"images/stickers/good/goodSticker13.png", id:"goodStick13"},
    {src:"images/stickers/good/goodSticker14.png", id:"goodStick14"},
    {src:"images/stickers/good/goodSticker15.png", id:"goodStick15"},
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
    teacher: null,
    makeButton:     function() { return (new createjs.Sprite(this.buttons));      },
    makeMiniButton: function() { return (new createjs.Sprite(this.miniButtons));  },
    makeTeacher:    function() { return (new createjs.Sprite(this.teacher)); }
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
    spriteSheets.buttons = new createjs.SpriteSheet({
        images: [queue.getResult("button")],
        frames: {width: 192, height: 82, regX: 96, regY: 40},
        animations: {
        playUp:       [0, 0, "playUp"  ],
        playOver:     [1, 1, "playOver"],
        playDown:     [2, 2, "playDown"],
        instructUp:   [3, 3, "instructUp"  ],
        instructOver: [4, 4, "instructOver"],
        instructDown: [5, 5, "instructDown"],
        menuUp:       [6, 6, "menuUp"  ],
        menuOver:     [7, 7, "menuOver"],
        menuDown:     [8, 8, "menuDown"],
        creditsUp:    [9, 9,   "creditsUp"  ],
        creditsOver:  [10, 10, "creditsOver"],
        creditsDown:  [11, 11, "creditsDown"],
        lockerUp:     [12, 12, "lockerUp"  ],
        lockerOver:   [13, 13, "lockerOver"],
        lockerDown:   [14, 14, "lockerDown"],
        cheatUp:      [15, 15, "cheatUp"  ],
        cheatOver:    [16, 16, "cheatOver"],
        cheatDown:    [17, 17, "cheatDown"],
        dummyp:       [18, 18, "dummyUp"  ],
        dummyver:     [19, 19, "dummyOver"],
        dummyown:     [20, 20, "dummySown"],
        } 
    });
    
    spriteSheets.teacher = new createjs.SpriteSheet({
        images: [queue.getResult("TeacherAnimation")],
        frames: [[0,0,309,348,0,22.45,215.3],[0,0,309,348,0,22.45,215.3],[0,0,309,348,0,22.45,215.3],[0,0,309,348,0,22.45,215.3],[0,0,309,348,0,22.45,215.3],[309,0,309,351,0,22.45,218.3],[309,0,309,351,0,22.45,218.3],[309,0,309,351,0,22.45,218.3],[309,0,309,351,0,22.45,218.3],[618,0,309,347,0,22.45,214.3],[618,0,309,347,0,22.45,214.3],[618,0,309,347,0,22.45,214.3],[618,0,309,347,0,22.45,214.3],[618,0,309,347,0,22.45,214.3],[618,0,309,347,0,22.45,214.3],[0,351,309,308,0,22.45,175.3],[0,351,309,308,0,22.45,175.3],[0,351,309,308,0,22.45,175.3],[0,351,309,308,0,22.45,175.3],[0,351,309,308,0,22.45,175.3],[0,351,309,308,0,22.45,175.3],[0,351,309,308,0,22.45,175.3],[0,351,309,308,0,22.45,175.3],[0,351,309,308,0,22.45,175.3],[0,351,309,308,0,22.45,175.3],[0,351,309,308,0,22.45,175.3],[618,0,309,347,0,22.45,214.3],[618,0,309,347,0,22.45,214.3],[618,0,309,347,0,22.45,214.3],[618,0,309,347,0,22.45,214.3],[618,0,309,347,0,22.45,214.3],[618,0,309,347,0,22.45,214.3],[309,0,309,351,0,22.45,218.3],[309,0,309,351,0,22.45,218.3],[309,0,309,351,0,22.45,218.3],[309,0,309,351,0,22.45,218.3]],
        animations: {
            Play:   [0, 35, "Play",0.125],
        } 
    });
    
    spriteSheets.miniButtons = new createjs.SpriteSheet({
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
}

//endregion

//region init
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

//to be called after files have been loaded
function init() {
    GameStates.StartScreen.container.addChild(  loadImage("title")        );
    GameStates.Game.container.addChild(         loadImage("GameScene")    );
    GameStates.Locker.container.addChild(       loadImage("locker")    );
    GameStates.Instructions.container.addChild( loadImage("instructions") );
    GameStates.Credits.container.addChild(      loadImage("credits")  );
    GameStates.GameOver.container.addChild(     loadImage("GameOver") );
    
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
        BTN.push(CreateButtonFromSprite(spriteSheets.makeButton(),"play",    function() { CurrentGameState = GameStates.Game;}));
        //if(lastTest !== null)
        {
            BTN.push(CreateButtonFromSprite(spriteSheets.makeButton(),"locker",    function() { CurrentGameState = GameStates.Locker;}));
        }
        BTN.push(CreateButtonFromSprite(spriteSheets.makeButton(),"instruct",function() { CurrentGameState = GameStates.Instructions; }));
        BTN.push(CreateButtonFromSprite(spriteSheets.makeButton(),"credits", function() { CurrentGameState = GameStates.Credits; }));
        
        stackButtons(BTN,10,new Coord(600,100));
        
        BTN.map(function(item) {
            GameStates.StartScreen.container.addChild(item);
        });
    }
    var PADDING = 5;
    //init instructions
    {
        var BTN_mainMenu = spriteSheets.makeButton();
        CreateButtonFromSprite(BTN_mainMenu,"menu",function() { CurrentGameState = GameStates.StartScreen; });
        BTN_mainMenu.x = stage.canvas.width - BTN_mainMenu.getBounds().width - PADDING+20;
        BTN_mainMenu.y = stage.canvas.height - BTN_mainMenu.getBounds().height - PADDING+20;
        GameStates.Instructions.container.addChild(BTN_mainMenu);
        
    }
    //init credits
    {
        var BTN_mainMenu_creditsScreen = CreateButtonFromSprite(spriteSheets.makeButton(),"menu",function() { CurrentGameState = GameStates.StartScreen; });
        BTN_mainMenu_creditsScreen.x = stage.canvas.width - BTN_mainMenu_creditsScreen.getBounds().width - PADDING;
        BTN_mainMenu_creditsScreen.y = stage.canvas.height - BTN_mainMenu_creditsScreen.getBounds().height - PADDING;
        GameStates.Credits.container.addChild(BTN_mainMenu_creditsScreen);
        
    }
    //init game
    initGameScene(GameStates.Game.container);
    initLocker(GameStates.Locker.container);
    //init gameOver
    (function GameOverInitFunction() {
        //lastTest
        //display test and score
        //offer button to goto home
        function MeButton(x,y, text) {
            this.box = new createjs.Shape();
            this.text = new createjs.Text(text,"bold italic 25px Rage", "#999");
            var pos = new Vec2(x,y);

            copyXY(this.text,pos);
            copyXY(this.box, pos);

            this.box.graphics.beginStroke("#FFF").drawRect(-20, 0, 70, 40);
            var hitArea = new createjs.Shape(new createjs.Graphics().beginFill("#000000").drawRect(-20, 0, 70, 40));
            this.box.hitArea = hitArea;
            GameStates.GameOver.container.addChild(this.box);
            GameStates.GameOver.container.addChild(this.text);
        }
        var currentQuestion = 0;
        
        var nextBtn = new MeButton(600,500, "next");
        var home = new MeButton(400,500, "Home");
        var prevBtn = new MeButton(100,500, "prev");
        nextBtn.box.on("click",  function(){ currentQuestion++; updateGraphics(); });
        home.box.on("click",  function(){ CurrentGameState = GameStates.StartScreen; });
        prevBtn.box.on("click",  function(){ currentQuestion--; updateGraphics(); });
        
        var title = new createjs.Text("You got x/x = 50% (A+)","25px EraserRegular","#fff");
        var question = new createjs.Text("#1) a + b = \nYour Answer: [number]\nCorrect Answer: [number]","25px EraserRegular","#fff");
        title.x = question.x = 100;
        title.y = 200;
        question.y = 300;
        GameStates.GameOver.container.addChild(title);
        GameStates.GameOver.container.addChild(question);
        
        GameStates.GameOver.enable = function() {
            currentQuestion = 0;
            updateGraphics();
        };
        function updateGraphics() {
            prevBtn.box.visible  = (currentQuestion > 0);
            prevBtn.text.visible = (currentQuestion > 0);
            nextBtn.box.visible  = (currentQuestion < lastTest.questions.length-1);
            nextBtn.text.visible = (currentQuestion < lastTest.questions.length-1);
            
            
            title.text = "You got "+lastTest.stats.correctAnswers+"/"+lastTest.stats.numOfQuestions()+" = "+(lastTest.stats.getScore()/10)+"% ("+lastTest.stats.grade().letter+")";
            var q = lastTest.questions;
            var i = currentQuestion;
            question.text = ""+(i+1)+") "+q[i].a+" "+q[i].operation.char+" "+q[i].b+" = \nYour Answer: "+q[i].userAnswer+"\nCorrect Answer: "+q[i].correctAnswer+"";
        }
        
        GameStates.GameOver.update = function() {
            
        };
        GameStates.GameOver.disable = function() {
            
        };
    }());
    
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
        copyXY(this.graphic,this.pos);
        this.scale = Rand(0,maxScale);
    }
    circle.prototype.update = function() {
        this.pos = this.pos.add(this.dir);
        if(!this.pos.sub(this.normalizedDir.mul(this.scale)).withinBox(screenDims)) {
            this.pos = this.pos.wrapByBox(screenDims).add(this.normalizedDir.mul(this.scale));
        }
        copyXY(this.graphic,this.pos);
        
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

//endregion template

//region GAMEOBJECT

//region game classes

var Stats = (function(){
    function Stats() {
        this.cheatCount = 0;
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        this.timesCaught = 0;
        this.numOfTests = 0;
        this.leftOverTime = 0;
        this.stickersBought = 0;
        this.points = 0;
        this.score = 0;
    }
    
    Stats.prototype.add = function(that) {
        var ret = new Stats();
        for(var i in this) {
            if(typeof ret[i] !== 'function')
            ret[i] = this[i] + that[i];
        }
        // roll score as average
        ret.score = (this.score * this.numOfTests + that.score * that.numOfTests)  / ret.numOfTests; // ret numof tests should already be set
        return ret;
    };
    Stats.prototype.numOfQuestions = function() {
        return this.correctAnswers + this.incorrectAnswers;
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
        mul: new BinaryMathOperation(function(a,b) { return a * b; },"x"),
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
        this.text = this.a+" "+operation.char+" "+this.b+" = ";
        this._incorrectPool = [];
        this.savedMultiChoice = [];
        //init incorrect pool
        {
            var i;
            for(i=-1;i<=1;i++) {
                for(var j=-1;j<=1;j++) {
                    if(i!==0 && j!==0) {
                        this._incorrectPool.push(this.operation.comboLogic(this.a+i,this.b+j));
                        if(this !== DefaultMathOperations.add) { this._incorrectPool.push(DefaultMathOperations.add.comboLogic(this.a+i,this.b+j)); }
                        if(this !== DefaultMathOperations.mul) { this._incorrectPool.push(DefaultMathOperations.mul.comboLogic(this.a+i,this.b+j)); }
                    }
                }
            }
            for(i = 1;i<4;i++) {
                this._incorrectPool.push(this.correctAnswer+i);
                this._incorrectPool.push(this.correctAnswer-i);
            }
            this._incorrectPool = Unique(Select(this._incorrectPool,function(item) { return Math.max(0,Math.round(item)); }));
        }
    }
    Question.prototype.genMultiChoice = function(num) {
        this.savedMultiChoice = new HashSet();
        var pool = new HashSet(this._incorrectPool);
        pool.remove(this.correctAnswer);
        var randomindex = Rand(0,num-1);
        while(this.savedMultiChoice.size() < num) {
            if(this.savedMultiChoice.size() == randomindex) {
                this.savedMultiChoice.add(this.correctAnswer);
            } else {
                var toAdd = RandomElement(pool.toList());
                this.savedMultiChoice.add(toAdd);
                pool.remove(toAdd);
            }
        }
        this.savedMultiChoice = this.savedMultiChoice.toList();
        return this.savedMultiChoice;
    };
    Question.prototype.replaceWith = function(that) {
        this.a = that.a;
        this.b = that.b;
        this.operation = that.operation;
        this.correctAnswer = that.correctAnswer;
        this.userAnswer = that.userAnswer;
        this.text = that.text;
    };
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
    }
    MathTest.prototype.generate = function() {
        this.caughtCheating = false;
        this.questions = [];
        this.stats.cheatCount = 0;
        for(var i=0;i<this.numOfQuestions;i++) {
            var operation = RandomElement(this.listOfOperations);
            var pair = operation.generatePair(this.rangeLow,this.rangeHigh);
            this.questions.push(new Question(pair.a,pair.b,operation));
        }
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
            this.stats.score = this.stats.correctAnswers / this.stats.numOfQuestions();
        }
    };
    
    return MathTest;
}());

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

function getCheat(question, percentForCorrect) {
    var ret = question.correctAnswer;
    if(Math.random() > percentForCorrect) {
        var set = new HashSet(question.savedMultiChoice);
        set.remove(question.correctAnswer);
        set.add(-1); // for chicken scratch
        ret = RandomElement(set.toList());
    }
    return ret;
}

//endregion game classes

//region global vars

var StockTests = [
    new MathTest([DefaultMathOperations.add]                                                                               ,10,1,12),
    new MathTest([DefaultMathOperations.add,DefaultMathOperations.sub]                                                     ,10,1,12),
    new MathTest([DefaultMathOperations.add,DefaultMathOperations.sub,DefaultMathOperations.mul]                           ,10,1,12),
    new MathTest([DefaultMathOperations.add,DefaultMathOperations.sub,DefaultMathOperations.mul,DefaultMathOperations.div] ,10,1,12)
];

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

var allStickers = []; // set this somehow

var myLocker = {
    myStickers: new HashSet(),
    bounds: new Bounds(new Coord(420,0),new Coord(660,370)), // update
};

var globalStats = new Stats();

var lastTest = null;

//endregion global vars

//endregion gameobj

var difficulty = StockTests.length-1;

var moodyMusic = [
    "Pos2", // really good
    "Pos1",
    "GamePlay",
    "Neg1",
    "Neg2" // really bad
];

function initGameScene(container) {
    var screenCover = new createjs.Shape();
    screenCover.graphics.beginFill("#000").drawRect(0, 0, stage.canvas.width, stage.canvas.height);
    screenCover.alpha = 0;
    
    var timer = new CountDownTimer(2*60);
    var test;
    
    var funnyResponces =  [
        "I hate Math",
        "...42?",
        "NaN",
        "I want\na retake",
        "numbers",
        "I'm so\nscrewed"
    ];
    
    var currentCheatPercent = 100;
    var cheatRange = 100;
    var cheating = -1;
    var questionsCheatedOn;
    var cheats;
    var cheatOverlay = new createjs.Shape();
    var cheatText = new createjs.Text("Cheater!","italic 20px Arial", "#888");
    
    var cheat1 = CreateButtonFromSprite(spriteSheets.makeButton(),"cheat"); cheat1.on("pressup",stopCheating); cheat1.on("mousedown",function() {startCheating(0);});
    var cheat2 = CreateButtonFromSprite(spriteSheets.makeButton(),"cheat"); cheat2.on("pressup",stopCheating); cheat2.on("mousedown",function() {startCheating(1);});
    var timeLeft = new createjs.Text("[time left]","25px EraserRegular","#fff");
    var teacher = spriteSheets.makeTeacher();
    // adding junk to container
    (function(){
        cheat1.scaleX = 0.6;    cheat1.scaleY = 0.6;
        cheat2.scaleX = 0.6;    cheat2.scaleY = 0.6;

        copyXY(cheat1,new Vec2(100,280));
        copyXY(cheat2,new Vec2(700,280));

        container.addChild(cheat1);
        container.addChild(cheat2);

        container.addChild(cheatText);

        cheatOverlay.graphics.beginFill("#F00").drawRect(204, 225, 380, 600);
        container.addChild(cheatOverlay);
    


        copyXY(timeLeft,new Vec2(70,60));
        container.addChild(timeLeft);

        timer.timer.updateEvent.addCallBack(function() {
            timeLeft.text = "Time Left: "+prettyUpSeconds(timer.getTimeLeft(),"");
        });
        //teacher

        teacher.gotoAndPlay("Play");
        teacher.x = 600;
        teacher.y = 140;
        teacher.scaleX = 0.75;
        teacher.scaleY = 0.75;
        container.addChild(teacher);
    }());
    
    

    
    function Choice(x,y) {
        this.value = -1;
        this.box = new createjs.Shape();
        this.text = new createjs.Text("option","bold italic 35px Rage", "#999");
        this.pos = new Vec2(x,y);

        this.update = function() {
            copyXY(this.text,this.pos);
            copyXY(this.box, this.pos);
            this.text.text = this.value;
        };
        var instance = this;
        
        this.box.on("click",  function(){ makeChoice(instance.value); });

        this.box.graphics.beginStroke("#0A5").drawRect(-20, 0, 70, 40);
        var hitArea = new createjs.Shape(new createjs.Graphics().beginFill("#000000").drawRect(-20, 0, 70, 40));
        this.box.hitArea = hitArea;
        //border.graphics.setStrokeStyle(1);
        container.addChild(this.box);
        container.addChild(this.text);
    }

    var questions = {
        questions: [],
        currentQuestionIndex: 0,
        startingPos: new Vec2(250,350),
        spacing: new Vec2(0,70),
        currentQuestionText: new createjs.Text("Questions", "bold italic 35px Arial", "#000"),
        currentAnswerText: new createjs.Text(" ", "bold italic 35px Rage", "#000"),
        title: new createjs.Text("Super Hard Question 1 / 1", "bold italic 25px Arial", "#000"),
        options: [
            new Choice(300,400),
            new Choice(400,400),
            new Choice(500,400),
            new Choice(300,500),
            new Choice(400,500),
            new Choice(500,500)
        ],
        updateCurrentGraphic: function() {
            this.title.text = "Super Hard Question "+(this.currentQuestionIndex+1)+" / "+this.questions.length;
            var q = this.questions[this.currentQuestionIndex];
            this.currentQuestionText.text = q.text;
            copyXY(this.currentQuestionText,this.startingPos);

            this.currentAnswerText.text = q.userAnswer === null ? "???" : q.userAnswer;
            copyXY(this.currentAnswerText,this.startingPos.add(new Coord(150,0)));
            
            for(var i=0;i<questions.options.length;i++) {
                questions.options[i].value = test.questions[questions.currentQuestionIndex].savedMultiChoice[i];
                questions.options[i].update();
            }
        },
    };
    container.addChild(questions.currentQuestionText);
    container.addChild(questions.currentAnswerText);
    copyXY(questions.title,new Vec2(250,230));
    container.addChild(questions.title);
    
    function makeChoice(value) {
        questions.questions[questions.currentQuestionIndex++].userAnswer = value;
        
        if(questions.currentQuestionIndex < questions.questions.length) {
            questions.updateCurrentGraphic();
        } else {
            gameComplete();
        }
        
    }
    
    GameStates.Game.enable = function() {
        var musicIndex = Math.floor(globalStats.numOfQuestions() > 0 ? clamp((globalStats.cheatCount / globalStats.numOfQuestions())*moodyMusic.length,0,moodyMusic.length-1) : moodyMusic.length / 2);
        
        backgroundMusic.setSoundFromString(moodyMusic[musicIndex],true);
        //generate test
        questions.currentQuestionIndex = 0;
        questionsCheatedOn = new HashSet();
        test = StockTests[difficulty];
        test.generate();
        cheats = [[],[]];
        for(var i=0;i<test.questions.length;i++) {
            test.questions[i].genMultiChoice(questions.options.length);
            cheats[0][i] = getCheat(test.questions[i],0.6);
            cheats[1][i] = getCheat(test.questions[i],0.6);
         }
        //display test
        //reset collection
        questions.questions = test.questions;
        questions.updateCurrentGraphic();
        
        timer.start();
    };
    
    GameStates.Game.update = function() {
        if(cheating>=0) {
            if(Math.random() > currentCheatPercent) {
                //caught!
                //mark cheated
                test.caughtCheating = true;
                console.log("Dirty Cheater");
                gameComplete();
            }
            
            currentCheatPercent -= 2;
            currentCheatPercent = clamp(currentCheatPercent,0,cheatRange);
            cheatText.alpha = (100-currentCheatPercent) / 200;
        } else {
            currentCheatPercent += 2;
            currentCheatPercent = clamp(currentCheatPercent,0,cheatRange);
            cheatText.alpha = (100-currentCheatPercent) / 300;
        }
        copyXY(cheatText,new Vec2(40,425).add(new Vec2(650,0).mul(cheating)));
        cheatOverlay.alpha = (100-currentCheatPercent) / 100;
    };
    
    function startCheating(index) {
        cheating = index;
        questionsCheatedOn.add(questions.currentQuestionIndex);
        cheatText.text = cheats[cheating][questions.currentQuestionIndex];
        if(cheats[cheating][questions.currentQuestionIndex] < 0) {
            cheatText.text = RandomElement(funnyResponces);
        }
    }
    function stopCheating() {
        cheating = -1;
    }
    
    GameStates.Game.disable = function() {
        timer.stop();
        stopCheating();
    };
    
    function gameComplete(cheated) {
        timer.stop();
        test.updateStats();
        test.stats.cheatCount += questionsCheatedOn.size();
        if(!cheated) {
            createjs.Sound.play("PencilsDown");
            var grade = test.stats.grade();
            if(grade.letter.charAt(0) === "A") {
                test.stats.points += 7;
            } else if(grade.letter.charAt(0) === "B") {
                test.stats.points += 5;
            } else if(grade.letter.charAt(0) === "C") {
                test.stats.points += 2;
            } else if(grade.letter.charAt(0) === "D") {
                test.stats.points += 1;
            }
        }
        lastTest = test;
        globalStats = globalStats.add(test.stats);
        var blackOutTimer = new CountDownTimer(2);
        blackOutTimer.timeCompleteEvent.addCallBack(function() {
            setTimeout(function() {
                CurrentGameState = GameStates.GameOver;
                screenCover.alpha = 0;
            },2000);
        });
        blackOutTimer.timer.updateEvent.addCallBack(function() {
            var percent = 1 - blackOutTimer.time / blackOutTimer.startTime;
            screenCover.alpha = percent;
        });
        blackOutTimer.start();
    }
    
    timer.timeCompleteEvent.addCallBack(gameComplete);
    container.addChild(screenCover);
}

function copyXY(to,from) {
    to.x = from.x;
    to.y = from.y;
}



function initLocker(container) {
    //init stickers
    (function(){
        var i, toAdd;
        function cheatCount(level) {
            return function(stat) {return stat.cheatCount >= level;};
        }
        function testCount(level) {
            return function(stat) {return stat.numOfTests >= level;};
        }
        //bad
        for(i = 0; i<9;i++) {
            toAdd = new Sticker();
            toAdd.graphic = new loadImage("badStick"+i);
            toAdd.cost = i*2;
            toAdd.isUnlocked = cheatCount(i/2);

            allStickers.push(toAdd);
        }
        //good
        for(i = 0; i<16;i++) {
            toAdd = new Sticker();
            toAdd.graphic = new loadImage("goodStick"+i);
            toAdd.cost = i*2;
            toAdd.isUnlocked = testCount(i/2);

            allStickers.push(toAdd);
        }
    }());
    var validStickers = new HashSet();
    var newStickers = new HashSet();
    
    var homeButton = CreateButtonFromSprite(spriteSheets.makeButton(),"menu",function(){ CurrentGameState = GameStates.StartScreen; });
    container.addChild(homeButton);
    homeButton.scaleY = homeButton.scaleX = 0.5;
    homeButton.x = homeButton.y = 40;
    homeButton.x += 30;
    
    var statBackground = new createjs.Shape(new createjs.Graphics().beginFill("#0FF").drawRect(-5,-5,75,45));
    
    var displayOfStats = [
    /* 0 */ { txt: new createjs.Text("","bold 16px Arial", "#FFF"), back: statBackground.clone() },
    /* 1 */ { txt: new createjs.Text("","bold 16px Arial", "#FFF"), back: statBackground.clone() },
    /* 2 */ { txt: new createjs.Text("","bold 16px Arial", "#FFF"), back: statBackground.clone() },
    /* 3 */ { txt: new createjs.Text("","bold 16px Arial", "#FFF"), back: statBackground.clone() },
    /* 4 */ { txt: new createjs.Text("","bold 16px Arial", "#FFF"), back: statBackground.clone() }
    ];
    displayOfStats.map(function(item) {
       container.addChild(item.back);
    });
    displayOfStats.map(function(item) {
       container.addChild(item.txt);
    });
    
    function StickerClicked(cloneOfSticker) {
        //if(globalStats.points >= cloneOfSticker.cost)
        {
            cloneOfSticker.graphic.scaleX = cloneOfSticker.graphic.scaleY = 0.25;
            container.addChild(cloneOfSticker.graphic); // required?
            //buying sticker
            globalStats.points += cloneOfSticker.cost;
            //randomly place locker
            cloneOfSticker.pos = myLocker.bounds.randomPointInside();
            copyXY(cloneOfSticker.graphic,cloneOfSticker.pos);
            //register update
            cloneOfSticker.graphic.on("pressmove",function(evt) {
                var newPos = myLocker.bounds.clampWithinBounds(new Vec2(evt.stageX,evt.stageY));
                //var newPos = new Vec2(evt.stageX,evt.stageY);
                
                evt.target.x = newPos.x;
                evt.target.y = newPos.y;
                
            });
            cloneOfSticker.graphic.on("pressup", function() {
                // add check for trash?
            });
            myLocker.myStickers.add(cloneOfSticker);
        }
    }
    
    allStickers.map(function(item) {
        item.graphic.x = item.graphic.y = 100;
        item.graphic.scaleX = item.graphic.scaleY = 0.5;
        item.graphic.regX = item.graphic.getBounds().width / 2;
        item.graphic.regY = item.graphic.getBounds().height / 2;
        item.graphic.on("click",function() { StickerClicked(item.clone()); });
        //item.graphic.visible = false;
        container.addChild(item.graphic);
    });
    
    GameStates.Locker.enable = function() {
        backgroundMusic.setSoundFromString("GamePlay",true);
        
        //setup stats
        displayOfStats[0].txt.text = "Cheated \n"  +  globalStats.cheatCount  + " times";
        displayOfStats[1].txt.text = "Caught  \n"  +  globalStats.timesCaught + " times";
        displayOfStats[2].txt.text = "Grade:  \n"  +  globalStats.grade().letter        ;
        displayOfStats[3].txt.text = "Taken:  \n"  +  globalStats.numOfTests  + " tests";
        displayOfStats[4].txt.text = "Points: \n"  +  globalStats.points    +   " tests";
        var statsBounds = new Bounds(new Vec2(25,76),new Vec2(250,340));
        var placed = new HashSet();
        var toPlace = new HashSet(displayOfStats);
        while(toPlace.size() > 0) {
            toPlace.map(function(item) {
                var pos = statsBounds.randomPointInside();
                var valid = true;
                placed.map(function(item) {
                    var diff = pos.sub(item);
                    if(diff.lengthSquared() < 95*95) {
                        valid = false;
                    }
                });
                copyXY(item.txt,pos);
                copyXY(item.back,pos);
                if(valid) {
                    placed.add(pos);
                    toPlace.remove(item);
                }
            });
        }
            
            
            
            
            
            
            
            
            
            
        
        //setup stickers
        var oldStickers = new HashSet(validStickers.toList());
        validStickers.addAll(Where(allStickers,function(item) { item.isUnlocked(globalStats); }));
        newStickers = validStickers.removeSet(oldStickers);
        
        
    };
    
    
    var store = {
        currentPage: 0,
        elementsPerPage: 3,
        padding: new Vec2(30,0),
        shapes: {
            btnL: null,
            btnR: null,
            pool: (function(){
                var ret = [];
                for(var i=0;i<3;i++) {
                    ret.push({img: null, txt: new createjs.Text("","bold 16px Arial", "#FFF")});
                }
            }())
        },
        update: function() {
            this.shapes.btnL.visible = this.currentPage > 0;
            this.shapes.btnR.visible = (this.currentPage+1)*this.elementsPerPage < validStickers.size();
            var masterList = [];
            validStickers.map(function(item) {
                item.graphic.visible = false;
                masterList.push(item);
            });
            for(var i=0;i<this.elementsPerPage;i++) {
                var index = this.currentPage * this.elementsPerPage + i;
                if(index < masterList.length) {
                    
                } else {
                    this.shapes.pool[i].txt.visible = false;
                }
            }
        },
    };
    
    
    
    
    
    
}
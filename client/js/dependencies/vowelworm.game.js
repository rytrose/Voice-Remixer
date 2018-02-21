/**
 * @param {Object=} options Configuration options
 * @param {VowelWorm.instance|Array.<VowelWorm.instance>} options.worms Any
 * VowelWorm instances to begin with
 * @param {number=} [options.width=700] The width of the game board
 * @param {number=} [options.height=500] The height of the game board
 * @param {number=} [options.background=0xFFFFFF] The background color of the game
 * @param {HTMLElement=} [options.element=document.body] What to append the graph to
 * @constructor
 * @name VowelWorm.Game
 */
window.VowelWorm.Game = function (p5) {
    "use strict";

    var game = this;
    window.game = this;
    game.p5 = p5;
    game.margin = 50;

    game.x1 = 0;
    game.x2 = 4.0;
    game.y1 = 0;
    game.y2 = 3.0;

    game.minHz = 0;
    game.maxHz = 8000;

    game.numTrail = 10;

    /**
     * Represents the threshold in dB that VowelWorm's audio should be at in
     * order to to plot anything.
     * @see {@link isSilent}
     * @memberof VowelWorm.Game
     * @name silence
     * @type number
     */
    game.silence = -70;

    /**
     * Specify here which vowel mapping algorithm to use
     * @see {@link VowelWorm._MAPPING_METHODS}
     * @memberof VowelWorm.Game
     * @name map
     */
    game.map = window.VowelWorm._MAPPING_METHODS.linearRegression;
    // game.map = window.VowelWorm._MAPPING_METHODS.mfccFormants;
    // game.map = window.VowelWorm._MAPPING_METHODS.cepstrumFormants;

    /**
     * Indicates whether to normalize the MFCC vector before prediction
     * @memberof VowelWorm.Game
     * @name normalizeMFCCs
     * @type boolean
     */
    game.normalizeMFCCs = true;

    /**
     * Indicates whether to save time domain  and frequency domain data for experimentation.
     * @memberof VowelWorm.Game
     * @name saveData
     * @type boolean
     */
    game.saveData = false;

    /**
     * The number of past positions to keep when computing the simple moving average (SMA)
     * @memberof VowelWorm.Game
     * @name smoothingConstant
     * @type number
     */
    game.smoothingConstant = 5;

    /**
     * Contains all instances of worms for this game
     * @type Array.<Object>
     * @private
     */
    game.worms = [];

    var stopped = false;

    /**
     * You can change this with game.ipa = true/false
     * @type boolean
     * @memberof VowelWorm.Game
     * @name ipa
     */
    // var ipaEnabled = true;

    // var ipaChart = new PIXI.DisplayObjectContainer();

    /**
     * Begins animation of worms
     * @memberof VowelWorm.Game
     * @name play
     */
    game.draw = function () {
        game.drawWorm(game.p5);
    };

    /**
     * Inserts a worm into the ever-increasing frenzy of VowelWorm.
     * @param {window.VowelWorm.instance} worm
     * @memberof VowelWorm.Game
     * @name addWorm
     */
    game.addWorm = function (worm, stream) {
        var container = {};
        container.worm = worm;
        container.circles = [];
        container.stream = stream;

        game.p5.imageMode(game.p5.CENTER);

        // If stream is a MediaStream
        if (typeof stream === 'object' && stream['constructor']['name'] === 'MediaStream') {
            // Remove audio for animation
            var audiolessStream = stream.clone();
            audiolessStream.removeTrack(audiolessStream.getAudioTracks()[0]);
            var cap = game.p5.createCaptureFromStream(audiolessStream);
            cap.hide();
            container.video = cap;
            container.recording = false;
            game.worms.push(container);
        }
        // If stream is a video URL
        else {
            var video = game.p5.createVideo(stream);
            video.volume(0.0);
            video.loop();
            video.hide();
            container.video = video;
            container.recording = true;
            game.worms.push(container);
        }
    };

    /**
     * @private
     */
    game.drawWorm = function (p5) {
        var current_color = "#00FF00";
        game.worms.forEach(function (container) {
            var worm = container.worm,
                circles = container.circles;

            var coords = getCoords(container);

            if (coords !== null) {
                var doRender = true;

                var x = coords.x;
                var y = coords.y;

                var circle = {};
                circle.position = {};
                circle.position.x = x;
                circle.position.y = y;
                circle.tint = current_color;
                circles.unshift(circle);
            }
            current_color = getNextColor(current_color);
        });


        game.worms.forEach(function (container) {
            var circles = container.circles;

            // Calaculate fading alphas and maintain numTrail circles
            for (var i = 0; i < circles.length; i++) {
                var obj = circles[i];
                obj.alpha = 255 - p5.ceil(i * (255 / (game.numTrail - 1)));

                if (i >= game.numTrail) {
                    circles.splice(i, 1);
                    i--;
                }
            }

            // Draw circles
            for (var i = 0; i < circles.length; i++) {
                var circle = circles[i];
                p5.stroke(255);
                var color = p5.color(circle.tint);
                color.setAlpha(circle.alpha);
                p5.fill(color);
                p5.ellipse(circle.position.x, circle.position.y, 200);
            }

            // Draw video
            container.video.mask(maskImage);
            if (circles.length > 0) p5.image(container.video, circles[0].position.x, circles[0].position.y, 200, 200);
        });

    };

    var getCoords = function (container) {

        var buffer = container.worm.getFFT();

        if (isSilent(buffer)) {
            container.circles.pop();
            container.worm.resetPosition();
            return null;
        }

        // Get the position from the worm
        var position = container.worm.getPosition();

        // Transform (backness, height) to (x, y) canvas coordinates
        if (position.length) {
            var coords = transformToXAndY(position[0], position[1]);
            return coords;
        }
        return null;
    };

    /**
     * Transforms from vowel space (backness, height) to canvas space (x, y)
     * @param {number} backness
     * @param {number} height
     * @name transformToXAndY
     */
    var transformToXAndY = function (backness, height) {
        var xStart = game.x1;
        var xEnd = game.x2;
        var yStart = game.y1;
        var yEnd = game.y2;

        var xDist = game.p5.width / (xEnd - xStart);
        var yDist = game.p5.height / (yEnd - yStart);

        var adjustedX = (backness - xStart) * xDist + game.margin;
        var adjustedY = game.p5.height - (height - yStart) * yDist + game.margin;

        return {x: adjustedX, y: adjustedY};
    };

    /**
     * Determines whether, for plotting purposes, the audio data is silent or not
     * Compares against the threshold given for {@link game.silence}.
     * @param {Array.<number>|Float32Array} data - An array containing dB values
     * @return {boolean} Whether or not the data is essentially 'silent'
     */
    var isSilent = function (data) {
        for (var i = 0; i < data.length; i++) {
            if (data[i] > game.silence) {
                return false;
            }
        }
        return true;
    };

    //Color Functions
    //Converts an integer representing a color to an integer representing a color 45 degrees away
    var getNextColor = function (old_color) {
        if (typeof old_color == 'number') {
            old_color = old_color.toString(16);
            //Pad with 0's if necessary
            while (old_color.length < 6) {
                old_color = "0" + old_color;
            }
        }

        old_color = new tinycolor(old_color);
        var new_color = old_color.spin(45).toHexString();
        return new_color;
    };

    // /**
    //  * Fills the IPA Chart. A constructor helper method.
    //  */
    // var drawVowels = function() {
    //     if(!ipaChart.children.length) {
    //         var letters = [
    //             ["e",221.28871891963863,252.35519027188354],
    //             ["i",169.01833799969594,171.97765003235634],
    //             ["a",317.6219414250667,337.00896411883406],
    //             ["o",384.5714404194302,284.96641792056766],
    //             ["u",412.17314090483404,231.94657762575406]
    //         ];
    //         var chart = new PIXI.Sprite.fromImage("plot2.png");
    //         chart.position.x = 0 + game.margin;
    //         chart.position.y = 0 + game.margin;
    //         ipaChart.addChild(chart);
    //         // for(var i=0; i<letters.length; i++){
    //         //   var letter = new PIXI.Text(letters[i][0],{font: "35px sans-serif", fill: "black", align: "center"});
    //         //   letter.position.x = letters[i][1];
    //         //   letter.position.y = letters[i][2];
    //         //   ipaChart.addChild(letter);
    //         // }
    //     }
    // };
};

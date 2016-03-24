var largeThresh = 200;
var largeFrac = 0.85;
var smallFrac = 0.3;

var latency = 50;
var snapshotInterval = 100;




var vDeltaDecay = function (src, tgt) {
    tgt = new Physics.vector(tgt.x, tgt.y);
    var delta = tgt.clone();
    delta.vsub(src);

    if (delta.norm() > largeThresh) {
        delta.mult(largeFrac);
    } else {
        delta.mult(smallFrac);
    }

    src.vadd(delta);
};

var deltaDecay = function (src, tgt) {
    var delta = tgt - src;

    if (delta > largeThresh / 100) {
        delta *= largeFrac
    } else {
        delta *= smallFrac;
    }

    return src + delta;
};


//
// Simple example of bouncing balls
//
Physics({maxIPF: 1000}, function (clientWorld) {

    // TARGET SIM START


    var targetState = {angular: {}, old: {angular: {}}};


    var targetSim = Physics({maxIPF: 10000});
    var targetBall = Physics.body('circle', {
        radius: 80
    });
    targetSim.add(targetBall);
    var targetSimToNow = function () {
        // simulate to current time
        targetSim.step(Date.now());

        // copy the new target to the client's target
        targetState.pos = targetBall.state.pos.clone();
        targetState.old.pos = targetBall.state.old.pos.clone();

        targetState.vel = targetBall.state.vel.clone();
        targetState.old.vel = targetBall.state.old.vel.clone();

        targetState.acc = targetBall.state.acc.clone();
        targetState.old.acc = targetBall.state.old.acc.clone();

        targetState.angular.pos = targetBall.state.angular.pos;
        targetState.old.angular.pos = targetBall.state.old.angular.pos;

        targetState.angular.vel = targetBall.state.angular.vel;
        targetState.old.angular.vel = targetBall.state.old.angular.vel;

        targetState.angular.acc = targetBall.state.angular.acc;
        targetState.old.angular.acc = targetBall.state.old.angular.acc;

    };

    // TARGET SIM END


    // bounds of the window
    var viewportBounds = Physics.aabb(0, 0, window.innerWidth, window.innerHeight)
        ,edgeBounce
        ,renderer
        ;

    // create a renderer
    renderer = Physics.renderer('canvas', {
        el: 'viewport'
    });

    // add the renderer
    clientWorld.add(renderer);

    // create some bodies
    var clientBall = Physics.body('circle', {
        radius: 80
        ,styles: {
            fillStyle: '#cb4b16'
            ,angleIndicator: '#72240d'
        }
    });
    clientWorld.add( clientBall );

    Physics.util.ticker.on(function (time) {
        clientWorld.step(time);
        clientWorld.render();
    });


    clientWorld.on('step', function () {

        targetSimToNow();

        if (targetState.pos != null) {
            vDeltaDecay(clientBall.state.pos, targetState.pos);
            vDeltaDecay(clientBall.state.old.pos, targetState.old.pos);

            vDeltaDecay(clientBall.state.vel, targetState.vel);
            vDeltaDecay(clientBall.state.old.vel, targetState.old.vel);

            vDeltaDecay(clientBall.state.acc, targetState.acc);
            vDeltaDecay(clientBall.state.old.acc, targetState.old.acc);
        } else {
            console.log("no target state");
        }
    });


    Physics({maxIPF: 1000}, function (serverWorld) {

        // create some bodies
        var serverBall = Physics.body('circle', {
            x: renderer.width * 0.4
            ,y: renderer.height * 0.3
            ,vx: 0.3
            ,radius: 80
            ,styles: {
                fillStyle: 'rgba(255, 255, 255, 0.3)'
                ,lineStyle: 'rgb(0,0,0)'
                ,angleIndicator: '#72240d'
            }
        });
        serverWorld.add( serverBall );

        // create a renderer
        var serverRenderer = Physics.renderer('canvas', {
            el: 'viewport'
        });

        // add the renderer
        serverWorld.add(serverRenderer);

        // constrain objects to these bounds
        edgeBounce = Physics.behavior('edge-collision-detection', {
            aabb: viewportBounds
            ,restitution: 0.99
            ,cof: 0.8
        });


        serverWorld.add([
            Physics.behavior('constant-acceleration')
            ,Physics.behavior('body-impulse-response')
            ,edgeBounce
        ]);


        var sendClient = function (state, time) {
            // TODO: COPY state to a thing that won't close before
            // the timeout callback is called
            //
            var targetState = {old: {angular: {}}, angular: {}};

            targetState.pos = state.pos.clone();
            targetState.old.pos = state.old.pos.clone();

            targetState.vel = state.vel.clone();
            targetState.old.vel = state.old.vel.clone();

            targetState.acc = state.acc.clone();
            targetState.old.acc = state.old.acc.clone();

            targetState.angular.pos = state.angular.pos;
            targetState.old.angular.pos = state.old.angular.pos;

            targetState.angular.vel = state.angular.vel;
            targetState.old.angular.vel = state.old.angular.vel;

            targetState.angular.acc = state.angular.acc;
            targetState.old.angular.acc = state.old.angular.acc;

            setTimeout(function () {
                // get the sim's last step time up to the state's time
                targetSim._time = time;

                targetBall.state = targetState;

            }, latency);
        };

        var lastSnapshotTime = 0;
        Physics.util.ticker.on(function( time ) {
            serverWorld.step(time);
            serverWorld.render();

            if (time - lastSnapshotTime > snapshotInterval) {
                sendClient(serverBall.state, time);
                lastSnapshotTime = time;
            }
        });
    });
});

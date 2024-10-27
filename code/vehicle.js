"use strict";

function drawCars() {
  for (const v of vehicles) v.draw();
}

function updateCars() {
  // spawn in more vehicles
  const playerIsSlow = titleScreenMode || playerVehicle.velocity.z < 20;
  const trafficPosOffset = playerIsSlow ? 0 : 16e4; // check in front/behind
  const trafficLevel =
    (playerVehicle.pos.z + trafficPosOffset) / checkpointDistance;
  const trafficLevelInfo = getLevelInfo(trafficLevel);
  const trafficDensity = trafficLevelInfo.trafficDensity;
  const maxVehicleCount = 10 * trafficDensity;
  if (trafficDensity)
    if (
      vehicles.length < maxVehicleCount &&
      !gameOverTimer.isSet() &&
      !vehicleSpawnTimer.active()
    ) {
      const spawnOffset = playerIsSlow ? -1300 : rand(5e4, 6e4);
      spawnVehicle(playerVehicle.pos.z + spawnOffset);
      vehicleSpawnTimer.set(rand(1, 2) / trafficDensity);
    }

  for (const v of vehicles) v.update();
  vehicles = vehicles.filter((o) => !o.destroyed);
}

function spawnVehicle(z) {
  if (disableAiVehicles) return;

  const v = new Vehicle(z);
  vehicles.push(v);
  v.update();
}

///////////////////////////////////////////////////////////////////////////////

class Vehicle {
  constructor(z, color) {
    this.pos = vec3(0, 0, z);
    this.color = color;
    this.isBraking = 0;
    this.drawTurn = this.drawPitch = this.wheelTurn = 0;
    this.collisionSize = vec3(230, 200, 380);
    this.velocity = vec3();

    if (!this.color) {
      this.color = // random color
        randInt(9)
          ? hsl(rand(), rand(0.5, 0.9), 0.5)
          : randInt(2)
          ? WHITE
          : hsl(0, 0, 0.1);

      // not player if no color
      //if (!isPlayer)
      {
        if ((this.isTruck = randInt(2))) {
          // random trucks
          this.collisionSize.z = 450;
          this.truckColor = hsl(rand(), rand(0.5, 1), rand(0.2, 1));
        }

        // do not pick same lane as player if behind
        const levelInfo = getLevelInfo(this.pos.z / checkpointDistance);
        this.lane = randInt(levelInfo.laneCount);
        if (!titleScreenMode && z < playerVehicle.pos.z)
          this.lane = playerVehicle.pos.x > 0 ? 0 : levelInfo.laneCount - 1;
        this.laneOffset = this.getLaneOffset();
        this.velocity.z = this.getTargetSpeed();
      }
    }
  }

  getTargetSpeed() {
    const levelInfo = getLevelInfo(this.pos.z / checkpointDistance);
    const lane = levelInfo.laneCount - 1 - this.lane; // flip side
    return max(120, 120 + lane * 20); // faster on left
  }

  getLaneOffset() {
    const levelInfo = getLevelInfo(this.pos.z / checkpointDistance);
    const o = ((levelInfo.laneCount - 1) * laneWidth) / 2;
    return this.lane * laneWidth - o;
  }

  update() {
    ASSERT(this != playerVehicle);

    // update ai vehicles
    const targetSpeed = this.getTargetSpeed();
    const accel = this.isBraking
      ? (--this.isBraking, -1)
      : this.velocity.z < targetSpeed
      ? 0.5
      : this.velocity.z > targetSpeed + 10
      ? -0.5
      : 0;

    const trackInfo = new TrackSegmentInfo(this.pos.z);
    const trackInfo2 = new TrackSegmentInfo(this.pos.z + trackSegmentLength);
    const level = (this.pos.z / checkpointDistance) | 0;
    const levelInfo = getLevelInfo(level);

    {
      // update lanes
      this.lane = min(this.lane, levelInfo.laneCount - 1);
      //if (rand() < .01 && this.pos.z > playerVehicle.pos.z)
      //    this.lane = randInt(levelInfo.laneCount);

      // move into lane
      const targetLaneOffset = this.getLaneOffset();
      this.laneOffset = lerp(0.01, this.laneOffset, targetLaneOffset);
      const lanePos = this.laneOffset;
      this.pos.x = lanePos;
    }

    // update physics
    this.pos.z += this.velocity.z = max(0, this.velocity.z + accel);

    // slow down if too close to other vehicles
    const x = this.laneOffset;
    for (const v of vehicles) {
      // slow down if behind
      if (v != this && v != playerVehicle)
        if (this.pos.z < v.pos.z + 500 && this.pos.z > v.pos.z - 2e3)
          if (abs(x - v.laneOffset) < 500) {
            // lane space
            if (this.pos.z >= v.pos.z) this.destroyed = 1; // get rid of overlaps
            this.velocity.z = min(this.velocity.z, v.velocity.z++); // clamp velocity & push
            this.isBraking = 20;
            break;
          }
    }

    // move ai vehicles
    this.pos.x = trackInfo.pos.x + x;
    this.pos.y = trackInfo.offset.y;

    // get projected track angle
    const delta = trackInfo2.pos.subtract(trackInfo.pos);
    this.drawTurn = Math.atan2(delta.x, delta.z);
    this.wheelTurn = this.drawTurn / 2;
    this.drawPitch = trackInfo.pitch;

    // remove in front or behind
    const playerDelta = this.pos.z - playerVehicle.pos.z;
    this.destroyed |= playerDelta > 7e4 || playerDelta < -2e3;
  }

  draw() {
    const trackInfo = new TrackSegmentInfo(this.pos.z);
    const vehicleHeight = 75;
    const p = this.pos.copy();
    p.y += vehicleHeight;
    p.z = p.z - cameraOffset;

    if (p.z < 0 && !freeCamMode) {
      // causes glitches if rendered
      return; // behind camera
    }

    /*{       // test cube
                //p.y = trackInfo.offset.y;
                const heading = this.drawTurn+PI/2;
                const trackPitch = trackInfo.pitch;
                const m2 = buildMatrix(p.add(vec3(0,-vehicleHeight,0)), vec3(trackPitch,0,0));
                const m1 = m2.multiply(buildMatrix(0, vec3(0,heading,0), 0));
                cubeMesh.render(m1.multiply(buildMatrix(0, 0, vec3(50,20,2e3))), this.color); 
               // return
        }*/

    // car
    const heading = this.drawTurn;
    const trackPitch = trackInfo.pitch;

    const carPitch = this.drawPitch;
    const mHeading = buildMatrix(0, vec3(0, heading), 0);
    const m1 = buildMatrix(p, vec3(carPitch, 0)).multiply(mHeading);
    const mcar = m1.multiply(
      buildMatrix(0, 0, vec3(450, this.isTruck ? 700 : 500, 450))
    );

    {
      // shadow
      glSetDepthTest(this != playerVehicle, 0); // no depth test for player shadow
      glPolygonOffset(60);
      const lightOffset = vec3(0, 0, -60).rotateY(worldHeading);
      const shadowColor = rgb(0, 0, 0, 0.5);
      const shadowPosBase = vec3(p.x, trackInfo.pos.y, p.z).addSelf(
        lightOffset
      );
      const shadowSize = vec3(-720, 200, 600); // why x negative?

      const m2 = buildMatrix(shadowPosBase, vec3(trackPitch, 0)).multiply(
        mHeading
      );
      const mshadow = m2.multiply(buildMatrix(0, 0, shadowSize));
      shadowMesh.renderTile(
        mshadow,
        shadowColor,
        spriteList.carShadow.spriteTile
      );
      glPolygonOffset();
      glSetDepthTest();
    }

    carMesh.render(mcar, this.color);
    //cubeMesh.render(m1.multiply(buildMatrix(0, 0, this.collisionSize)), BLACK);  // collis

    let bumperY = 130,
      bumperZ = -440;
    if (this.isTruck) {
      bumperY = 50;
      bumperZ = -560;
      const truckO = vec3(0, 290, -250);
      const truckColor = this.truckColor;
      const truckSize = vec3(240, truckO.y, 300);
      glPolygonOffset(20);
      cubeMesh.render(
        m1.multiply(buildMatrix(truckO, 0, truckSize)),
        truckColor
      );
    }
    glPolygonOffset(); // turn it off!

    if (optimizedCulling) {
      const distanceFromPlayer = this.pos.z - playerVehicle.pos.z;
      if (distanceFromPlayer > 4e4) return; // cull too far
    }

    // wheels
    const wheelRadius = 110;
    const wheelSpinScale = 400;
    const wheelSize = vec3(50, wheelRadius, wheelRadius);
    const wheelM1 = buildMatrix(
      0,
      vec3(this.pos.z / wheelSpinScale, this.wheelTurn),
      wheelSize
    );
    const wheelM2 = buildMatrix(
      0,
      vec3(this.pos.z / wheelSpinScale, 0),
      wheelSize
    );
    const wheelColor = hsl(0, 0, 0.2);
    const wheelOffset1 = vec3(240, 25, 220);
    const wheelOffset2 = vec3(240, 25, -300);
    for (let i = 4; i--; ) {
      const wo = i < 2 ? wheelOffset1 : wheelOffset2;

      glPolygonOffset(this.isTruck && i > 1 && 20);
      const o = vec3(i % 2 ? wo.x : -wo.x, wo.y, i < 2 ? wo.z : wo.z);
      carWheel.render(
        m1.multiply(buildMatrix(o)).multiply(i < 2 ? wheelM1 : wheelM2),
        wheelColor
      );
    }

    // decals
    glPolygonOffset(40);

    // bumpers
    cubeMesh.render(
      m1.multiply(buildMatrix(vec3(0, bumperY, bumperZ), 0, vec3(140, 50, 20))),
      hsl(0, 0, 0.1)
    );

    // break lights
    const isBraking = this.isBraking;
    for (let i = 2; i--; ) {
      const color = isBraking ? hsl(0, 1, 0.5) : hsl(0, 1, 0.2);
      glEnableLighting = !isBraking; // make it full bright when braking
      cubeMesh.render(
        m1.multiply(
          buildMatrix(
            vec3((i ? 1 : -1) * 180, bumperY - 25, bumperZ - 10),
            0,
            vec3(40, 25, 5)
          )
        ),
        color
      );
      glEnableLighting = 1;
      cubeMesh.render(
        m1.multiply(
          buildMatrix(
            vec3((i ? 1 : -1) * 180, bumperY + 25, bumperZ - 10),
            0,
            vec3(40, 25, 5)
          )
        ),
        WHITE
      );
    }

    if (this == playerVehicle) {
      // only player needs front bumper
      cubeMesh.render(
        m1.multiply(buildMatrix(vec3(0, 10, 440), 0, vec3(240, 30, 30))),
        hsl(0, 0, 0.5)
      );

      // license plate
      quadMesh.renderTile(
        m1.multiply(
          buildMatrix(
            vec3(0, bumperY - 80, bumperZ - 20),
            vec3(0, PI, 0),
            vec3(80, 25, 1)
          )
        ),
        WHITE,
        spriteList.carLicense.spriteTile
      );

      // top number
      const m3 = buildMatrix(0, vec3(0, PI)); // flip for some reason
      quadMesh.renderTile(
        m1.multiply(
          buildMatrix(
            vec3(0, 230, -200),
            vec3(PI / 2 - 0.2, 0, 0),
            vec3(140)
          ).multiply(m3)
        ),
        WHITE,
        spriteList.carNumber.spriteTile
      );
    }

    glPolygonOffset();
  }
}

///////////////////////////////////////////////////////////////////////////////

class PlayerVehicle extends Vehicle {
  constructor(z, color) {
    super(z, color, 1);
    this.playerTurn = this.bumpTime = this.onGround = this.engineTime = 0;
    this.hitTimer = new Timer();
  }

  draw() {
    titleScreenMode || super.draw();
  }

  update() {
    if (titleScreenMode) {
      this.pos.z += this.velocity.z = 20;
      return;
    }

    const playHitSound = () => {
      if (!this.hitTimer.active()) {
        sound_hit.play(percent(this.velocity.z, 0, 50));
        this.hitTimer.set(0.5);
      }
    };

    const hitBump = (amount = 0.98) => {
      this.velocity.z *= amount;
      if (this.bumpTime < 0) {
        sound_bump.play(percent(this.velocity.z, 0, 50));
        this.bumpTime = 500 * rand(1, 1.5);
        this.velocity.y += min(50, this.velocity.z) * rand(0.1, 0.2);
      }
    };

    this.bumpTime -= this.velocity.z;

    if (
      !freeRide &&
      checkpointSoundCount > 0 &&
      !checkpointSoundTimer.active()
    ) {
      sound_checkpoint.play();
      checkpointSoundTimer.set(0.26);
      checkpointSoundCount--;
    }

    const playerDistance = playerVehicle.pos.z;
    if (!gameOverTimer.isSet())
      if (playerDistance > nextCheckpointDistance) {
        // checkpoint
        ++playerLevel;
        nextCheckpointDistance += checkpointDistance;
        checkpointTimeLeft += extraCheckpointTime;
        if (enhancedMode) checkpointTimeLeft = min(60, checkpointTimeLeft);

        if (playerLevel >= levelGoal && !gameOverTimer.isSet()) {
          // end of game
          playerWin = 1;
          sound_win.play();
          gameOverTimer.set();
          if (!(debug && debugSkipped))
            if (!freeRide) {
              bestDistance = 0; // reset best distance
              if (raceTime < bestTime || !bestTime) {
                // new fastest time
                bestTime = raceTime;
                playerNewRecord = 1;
              }
              writeSaveData();
            }
        } else {
          //speak('CHECKPOINT');
          checkpointSoundCount = 3;
        }
      }

    // check for collisions
    if (!testDrive)
      for (const v of vehicles) {
        const d = this.pos.subtract(v.pos);
        const s = this.collisionSize.add(v.collisionSize);
        if (v != this && abs(d.x) < s.x && abs(d.z) < s.z) {
          // collision
          this.velocity.z = v.velocity.z / 2;
          v.velocity.z = max(v.velocity.z, this.velocity.z * 1.5); // push other car
          this.velocity.x = 99 * sign(d.x); // push away from car
          playHitSound();
        }
      }

    // get player input
    let playerInputTurn = keyIsDown("ArrowRight") - keyIsDown("ArrowLeft");
    let playerInputGas = keyIsDown("ArrowUp");
    let playerInputBrake = keyIsDown("Space") || keyIsDown("ArrowDown");

    if (isUsingGamepad) {
      playerInputTurn = gamepadStick(0).x;
      playerInputGas = gamepadIsDown(0) || gamepadIsDown(7);
      playerInputBrake =
        gamepadIsDown(1) ||
        gamepadIsDown(2) ||
        gamepadIsDown(3) ||
        gamepadIsDown(6);

      const analogGas = gamepadGetValue(7);
      if (analogGas) playerInputGas = analogGas;
      const analogBrake = gamepadGetValue(6);
      if (analogBrake) playerInputBrake = analogBrake;
    }

    if (playerInputGas) mouseControl = 0;
    if (
      debug &&
      (mouseWasPressed(0) ||
        mouseWasPressed(2) ||
        (isUsingGamepad && gamepadWasPressed(0)))
    )
      testDrive = 0;

    if (mouseControl || mouseIsDown(0)) {
      mouseControl = 1;
      playerInputTurn = clamp(10 * (mousePos.x - 0.5), -1, 1);
      playerInputGas = mouseIsDown(0);
      playerInputBrake = mouseIsDown(2);

      if (isTouchDevice && mouseIsDown(0)) {
        const touch = 1.8 - 2 * mousePos.y;
        playerInputGas = percent(touch, 0.1, 0.2);
        playerInputBrake = touch < 0;
        playerInputTurn = clamp(3 * (mousePos.x - 0.5), -1, 1);
      }
    }
    if (freeCamMode) playerInputGas = playerInputTurn = playerInputBrake = 0;
    if (testDrive) (playerInputGas = 1), (playerInputTurn = 0);
    if (gameOverTimer.isSet())
      playerInputGas = playerInputTurn = playerInputBrake = 0;
    this.isBraking = playerInputBrake;

    const sound_velocity = max(40 + playerInputGas * 50, this.velocity.z);
    this.engineTime += (sound_velocity * sound_velocity) / 5e4;
    if (this.engineTime > 1) {
      --this.engineTime;
      const f = sound_velocity;
      sound_engine.play(0.1, (f * f) / 4e3 + rand(0.1));
    }

    // player settings
    const forwardDamping = 0.9978; // dampen player z speed
    const playerTurnControl = 0.4; // player turning rate
    const gravity = -3; // gravity to apply in y axis
    const lateralDamping = 0.5; // dampen player x speed
    const playerAccel = 1; // player acceleration
    const playerBrake = 3; // player acceleration when braking
    const playerMaxSpeed = 200; // limit max player speed
    const speedPercent = this.velocity.z / playerMaxSpeed;

    // update physics
    this.velocity.y += gravity;
    this.velocity.x *= lateralDamping;
    this.pos.addSelf(this.velocity);

    const playerTrackInfo = new TrackSegmentInfo(this.pos.z);
    const playerTrackSegment = playerTrackInfo.segmentIndex;

    // clamp player x position
    const maxPlayerX = playerTrackInfo.width + 500;
    this.pos.x = clamp(this.pos.x, -maxPlayerX, maxPlayerX);

    // check if on ground
    const wasOnGround = this.onGround;
    this.onGround = this.pos.y < playerTrackInfo.offset.y;
    if (this.onGround) {
      this.pos.y = playerTrackInfo.offset.y;
      const trackPitch = playerTrackInfo.pitch;
      this.drawPitch = lerp(0.2, this.drawPitch, trackPitch);

      // bounce elasticity (2 is full bounce, 1 is none)
      const elasticity = 1.2;

      // bounce off track
      // todo use vector math
      const reflectVelocity = vec3(
        0,
        Math.cos(trackPitch),
        Math.sin(trackPitch)
      ).scale(
        -elasticity *
          (Math.cos(trackPitch) * this.velocity.y +
            Math.sin(trackPitch) * this.velocity.z)
      );

      if (!gameOverTimer.isSet())
        // dont roll in game over
        this.velocity.addSelf(reflectVelocity);

      if (!wasOnGround) {
        const p = percent(reflectVelocity.length(), 20, 80);
        sound_bump.play(p * 2, 0.5);
        this.onGround = 1;
      }

      const trackSegment = track[playerTrackSegment];
      if (trackSegment && !trackSegment.sideStreet)
        if (
          abs(this.pos.x) > playerTrackInfo.width - this.collisionSize.x &&
          !testDrive
        )
          // side streets are not offroad
          hitBump(); // offroad

      // update velocity
      if (playerInputBrake) this.velocity.z -= playerBrake * playerInputBrake;
      else if (playerInputGas) {
        // extra boost at low speeds
        //const lowSpeedPercent = this.velocity.z**2/1e4;
        const lowSpeedPercent = percent(this.velocity.z, 150, 0) ** 2;
        const accel =
          playerInputGas *
          playerAccel *
          lerp(speedPercent, 1, 0.5) *
          lerp(lowSpeedPercent, 1, 9);
        //console.log(lerp(lowSpeedPercent, 1, 9))

        // apply acceleration in angle of road
        //const accelVec = vec3(0,0,accel).rotateX(trackSegment.pitch);
        //this.velocity.addSelf(accelVec);
        this.velocity.z += accel;
      } else if (this.velocity.z < 30) this.velocity.z *= 0.9; // slow to stop

      // dampen z velocity & clamp
      this.velocity.z = max(0, this.velocity.z * forwardDamping);
    } else {
      // in air
      this.drawPitch *= 0.99; // level out pitch
      this.onGround = 0;
    }

    {
      // turning
      let desiredPlayerTurn =
        startCountdown > 0 ? 0 : playerInputTurn * playerTurnControl;
      if (testDrive) {
        desiredPlayerTurn = clamp(-this.pos.x / 2e3, -1, 1);
        this.pos.x = clamp(
          this.pos.x,
          -playerTrackInfo.width,
          playerTrackInfo.width
        );
      }

      const playerMaxTurnStart = 50; // fade on turning visual
      const turnVisualRamp = clamp(this.velocity.z / playerMaxTurnStart);
      this.wheelTurn = lerp(0.1, this.wheelTurn, 1.5 * desiredPlayerTurn);
      this.playerTurn = lerp(0.05, this.playerTurn, desiredPlayerTurn);
      this.drawTurn = lerp(
        turnVisualRamp * turnVisualRamp,
        this.drawTurn,
        this.playerTurn
      );

      // fade off turn at top speed
      const turnStrength = 1.8;
      const physicsTurn = this.onGround
        ? this.playerTurn * turnStrength * lerp(speedPercent, 1, 0.5)
        : 0;

      // apply turn velocity
      const centrifugal = 0.04; // how much to pull player on turns
      const turnPow = 1.5;
      this.velocity.x +=
        this.velocity.z * physicsTurn -
        this.velocity.z ** turnPow * centrifugal * playerTrackInfo.offset.x;

      /* // slip test

            const playerMaxTurnStart = 50; // fade on turning visual
            const turnVisualRamp = clamp(this.velocity.z/playerMaxTurnStart,0,.1);
            this.wheelTurn = lerp(.1, this.wheelTurn, 1.5*desiredPlayerTurn);
            this.playerTurn = lerp(.1, this.playerTurn, desiredPlayerTurn);

            // fade off turn at top speed
            const turnStrength = .02;
           // const physicsTurn = this.onGround ?this.playerTurn*turnStrength*lerp(speedPercent, 1, .5) : 0;

            const physicsTurn = this.playerTurn*turnStrength;

            // apply turn velocity

            const centrifugal = .5;  
            const centripetalForce = -this.velocity.z * playerTrackInfo.offset.x * centrifugal;
            const turnForce = 50*this.velocity.z * physicsTurn;

            const maxStaticFriction = 40;

            //const deltaX = turnForce + centripetalForce;;

            let slip = 1;

            if (abs(centripetalForce) > maxStaticFriction)
            {
                let s = abs(centripetalForce) / maxStaticFriction;
                slip = 1/s;
                //slip = slip**2
                console.log(abs(centripetalForce), slip)
            }

            this.velocity.x += turnForce*slip + centripetalForce;

            const slipVis = lerp(percent(slip, 1, .5),1,1.5)

            this.drawTurn = lerp(turnVisualRamp,
                this.drawTurn, (this.playerTurn)*slipVis);

            */
    }

    if (playerWin) this.drawTurn = lerp(gameOverTimer.get(), this.drawTurn, -1);
    if (startCountdown > 0) this.velocity.z = 0; // wait to start
    if (gameOverTimer.isSet()) this.velocity = this.velocity.scale(0.95);

    if (!testDrive) {
      // check for collisions
      const collisionCheckDistance = 20; // segments to check
      for (let i = -collisionCheckDistance; i < collisionCheckDistance; ++i) {
        const segmentIndex = playerTrackSegment + i;
        const trackSegment = track[segmentIndex];
        if (!trackSegment) continue;

        // collidable objects
        for (const trackObject of trackSegment.trackObjects) {
          if (!trackObject.collideSize) continue;

          const pos = trackSegment.offset.add(trackObject.offset);
          const dp = this.pos.subtract(pos);

          const csx = 230 + trackObject.collideSize; // js13k hack
          if (abs(dp.z) > 430 || abs(dp.x) > csx) continue;

          //const cs = vec3(trackObject.collideSize,0,50),addSelf(this.collisionSize);
          //if (abs(dp.z) > cs.z || abs(dp.x) > cs.x)// js13k hack
          //    continue;

          if (trackObject.sprite.isBump) {
            trackObject.collideSize = 0; // prevent colliding again
            hitBump(0.8); // hit a bump
          } else if (trackObject.sprite.isSlow) {
            trackObject.collideSize = 0; // prevent colliding again
            sound_bump.play(percent(this.velocity.z, 0, 50) * 3, 0.2);
            // just slow down the player
            this.velocity.z *= 0.85;
          } else {
            // push player away
            const onSideOfTrack =
              abs(pos.x) + csx + 200 > playerTrackInfo.width;
            const pushDirection = onSideOfTrack
              ? -pos.x // push towards center
              : dp.x; // push away from object

            this.velocity.x = 99 * sign(pushDirection);
            this.velocity.z *= 0.7;
            playHitSound();
          }
        }
      }
    }
  }
}
"use strict";

const hardAlpha = 1;
const generativeTileSize = 512;
const generativeCanvasSize = generativeTileSize * 8;
const fixFirefoxFontBug = 1; // fix firefox not drawing fonts below a min size
const spriteSize =
  (generativeTileSize - 2 * bleedPixels) / generativeCanvasSize;

function initGenerative() {
  // create the textures
  generateTetures();

  if (debug) {
    debugGenerativeCanvasCached = document.createElement("canvas");
    debugGenerativeCanvasCached.height = debugGenerativeCanvasCached.width =
      generativeCanvasSize;
    const context = debugGenerativeCanvasCached.getContext("2d");
    context.drawImage(mainCanvas, 0, 0);
  }

  // create webgl texture
  glContext.bindTexture(gl_TEXTURE_2D, glCreateTexture(mainCanvas));
}

function generateTetures() {
  const context = mainContext;
  mainCanvas.height = mainCanvas.width = generativeCanvasSize;
  random.setSeed(13);

  class Particle {
    constructor(
      x,
      y,
      vx,
      vy,
      accel,
      sizeStart = 0.1,
      sizeEnd = 0,
      c = BLACK,
      mutateColor = 0.1
    ) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.accel = accel;
      this.sizeStart = sizeStart;
      this.sizeEnd = sizeEnd;
      this.color = c;
      this.style = this.colorRandom = 0;
      this.iterations = 50;
      this.mutateColor = mutateColor;
    }

    draw() {
      const pos = vec3();
      for (let i = 0; i < this.iterations; ++i) {
        if (this.color)
          color(
            random.mutateColor(this.color, this.colorRandom, this.mutateColor)
          );
        const p = i / this.iterations;
        pos.x = this.x + this.vx * p;
        pos.y = this.y + this.vy * p + this.accel * p * p;
        const s = this.style
          ? Math.sin(p * PI) * (this.sizeStart - this.sizeEnd) + this.sizeEnd
          : lerp(p, this.sizeStart, this.sizeEnd);
        rect(pos.x, pos.y, s, s);
      }
      return pos;
    }
  }

  class Tree {
    constructor() {
      this.pos = vec3(0.5, 1);
      this.startWidth = 0.09;
      this.startLength = 0.01;
      this.branchAngle = 1.2;
      this.branchAngleRandomness = 0.1;
      this.branchRate = 451;
      this.branchLoss = 0.9;
      this.leafChance = 3;
      this.leafMaxSize = 0.06;
      this.leafOffset = 0.03;
      this.nodeScale = 0.98;
      this.crookedness = 0.02;
      this.lightPower = 0.01;
      this.minBranchSize = 0.005;
      this.leafHue = 0.3;
      this.leafBrightness = 0.4;
      this.flowerColor = RED;
      this.branchScale = 1;
      this.leafSat = 0.5;
      this.branchDieChance =
        this.multiBranch =
        this.flowerChance =
        this.stump =
          0;
    }

    draw() {
      let treeOverflow = 0;
      const leafList = [];
      const pos = this.pos;
      const startWidth = this.startWidth;
      const startLength = this.startLength;
      const branchAngle = this.branchAngle;
      const branchAngleRandomness = this.branchAngleRandomness;
      const branchRate = this.branchRate;
      const branchLoss = this.branchLoss;
      const branchDieChance = this.branchDieChance;
      const multiBranch = this.multiBranch;
      const leafChance = this.leafChance;
      const leafMaxSize = this.leafMaxSize;
      const leafOffset = this.leafOffset;
      const nodeScale = this.nodeScale;
      const crookedness = this.crookedness;
      const lightPower = this.lightPower;
      const minBranchSize = this.minBranchSize;
      const leafHue = this.leafHue;
      const leafBrightness = this.leafBrightness;
      const leafSat = this.leafSat;

      const treeLimb = (p, w, l, a = 0, b = 0, bs = random.bool() ? 1 : -1) => {
        //if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return;
        if (treeOverflow++ > 1e4) {
          debug && console.log("Tree overflow!");
          return;
        }

        if (w < minBranchSize) {
          // leaf
          if (!random.bool(leafChance)) return;
          for (let i = max(1, leafChance | 0); i--; ) leafList.push(p);
          return;
        }

        // draw limb
        const d = vec3(0, -l).rotateZ(a);
        const p2 = p.add(d);
        color(hsl(0.1, 0.6, random.float(0.1, 0.2)));
        rectLine(p.x, p.y, p2.x, p2.y, w);

        // branch
        if (b > branchRate * w) {
          const s1 = random.float(0.5, 1) * this.branchScale;
          const s2 = random.float(0.5, 1) * this.branchScale;
          treeLimb(
            p2,
            w * s1,
            l * s2,
            a + bs * (branchAngle + random.floatSign(branchAngleRandomness))
          );
          bs *= -1;
          b = 0;
          if (random.bool(multiBranch))
            treeLimb(
              p2,
              w * s1,
              l * s2,
              a + bs * (branchAngle + random.floatSign(branchAngleRandomness))
            );
          w *= branchLoss;
        }

        if (w < startWidth / 2 && random.bool(branchDieChance))
          // dead branches
          return;
        if (this.stump && treeOverflow > 300) return;

        // continue limb
        a *= 1 - lightPower;
        treeLimb(
          p2,
          (w *= nodeScale),
          l,
          (a += random.floatSign(crookedness)),
          b + 1,
          bs
        );
      };

      treeLimb(pos, startWidth, startLength);
      for (const i in shuffle(leafList)) {
        let leafPos = leafList[i];
        const p = i / leafList.length;
        const leafSize = (1 - p) * leafMaxSize;
        const sat = leafSat + random.floatSign(0.2);
        const brightness = 0.1 + random.float(p, 1) * leafBrightness;
        color(random.mutateColor(hsl(leafHue, sat, brightness), 0.1));
        leafPos = leafPos.add(random.circle(leafOffset));
        rect(leafPos.x, leafPos.y, leafSize, leafSize, random.float(2 * PI));
        if (random.bool(this.flowerChance))
          drawFlower(leafPos, 5, random.float(0.01, 0.02), this.flowerColor);
      }
    }
  }
  {
    // basic shapes
    color(WHITE);
    setupContext(0, 0);
    circle(0.5, 0.5, 0.45);
    setupContext(1, 0);
    // radial gradient
    for (let i = 40; i--; )
      color(hsl(0, 0, 1, i / 300)), circle(0.5, 0.5, 0.5 - i / 80);
    setupContext(2, 0);
    // rectangle gradient for car shadow
    for (let i = 40, a; i--; ) {
      color(hsl(0, 0, 1, (a = i / 40))),
        rect(0.5, 0.5, 0.5 - a / 3, 0.9 - a / 3);
    }
    setupContext(3, 0);
    drawLicensePlate();
    setupContext(4, 0);
    text(13, 0.5, 0.6, 1, 1, 0.04, undefined, undefined, 900);
    setupContext(6, 0);
    drawCheckpointSign(1);
    setupContext(7, 0);
    drawCheckpointSign(-1);

    // plants
    setupContext(0, 1);
    drawPalmTree();
    setupContext(1, 1);
    {
      // green tree
      random.setSeed(13);
      const t = new Tree();
      t.draw();
    }
    setupContext(2, 1);
    {
      // dead tree stump
      random.setSeed(192);
      const t = new Tree();
      t.startWidth = 0.1;
      t.branchRate = 300;
      t.leafChance = 0;
      t.branchAngle = 1.2;
      t.branchAngleRandomness = 0.2;
      t.branchDieChance = 0.03;
      t.lightPower = 0.05;
      t.crookedness = 0.1;
      t.draw();
    }
    setupContext(3, 1);
    {
      // dead tree
      random.setSeed(131);
      const t = new Tree();
      t.leafChance = 0;
      t.startWidth = 0.08;
      t.branchAngleRandomness = 0.5;
      t.branchAngle = 1.5;
      t.crookedness = 0.05;
      t.lightPower = 0.01;
      t.draw();
    }
    setupContext(4, 1);
    {
      // pink tree
      random.setSeed(400);
      const t = new Tree();
      t.crookedness = 0.1;
      t.branchAngle = 1.5;
      t.branchAngleRandomness = 0.1;
      t.leafHue = 0;
      t.leafSat = 0.7;
      t.leafBrightness = 0.7;
      t.lightPower = 0.02;
      t.flowerChance = 0.05;
      t.flowerColor = WHITE;
      t.draw();
    }
    setupContext(5, 1);
    {
      // low bush
      random.setSeed(1333);
      const t = new Tree();
      t.multiBranch = 1;
      t.branchRate = 800;
      t.startWidth = 0.04;
      t.minBranchSize = 0.005;
      t.branchAngle = 1.5;
      t.crookedness = 0.1;
      t.branchAngleRandomness = 0.2;
      t.leafChance = 4;
      t.leafOffset = 0.04;
      t.leafHue = 0.2;
      t.lightPower = 0.002;
      t.flowerChance = 0.01;
      t.draw();
    }
    setupContext(6, 1);
    {
      // fall tree
      random.setSeed(293);
      const t = new Tree();
      t.startWidth = 0.07;
      t.crookedness = 0.05;
      t.leafHue = 0.08;
      t.leafBrightness = 0.6;
      t.leafSat = 1;
      t.draw();
    }
    /*setupContext(7,1);
        {
            // tree with flowers
            random.setSeed(192);
            const t = new Tree;
            t.startWidth = .07;
            t.branchRate = 700;
            t.leafChance = .5;
            t.multiBranch = 1;
            t.branchAngle = 1.2;
            t.branchAngleRandomness = .2;
            t.leafHue = .35;
            t.flowerChance = .1;
            t.draw();
        }*/

    // signs
    random.setSeed(13);
    setupContext(0, 2);
    drawJS13kSign();
    setupContext(1, 2);
    drawZZFXSign();
    setupContext(2, 2);
    drawGitHubSign();
    setupContext(3, 2);
    //drawGenericSign('GAME BY FRANK FORCE',.25,BLACK,WHITE);
    drawDoubleLineSign("FRANK FORCE", "GAME BY", BLACK, 0, 0.42, 0.2);
    //drawGenericSign('Frank Force Games',.3,undefined,undefined,'monospace');
    //drawLittleJSSign();
    setupContext(4, 2);
    //drawHarrisSign();
    drawDoubleLineSign("HARRIS", "WALZ", hsl(0.6, 0.9, 0.3));
    setupContext(5, 2);
    drawOPSign();
    //drawGenericSign('VOTE',.5,WHITE,hsl(0,.9,.4),hsl(.6,.9,.3),0,'impact');
    //setupContext(6,2);
    //drawDwitterSign();
    setupContext(7, 2);
    drawAvalancheSign();

    // grass,flowers, more trees
    setupContext(0, 3);
    drawGrass();
    setupContext(1, 3);
    drawGrass(0.23, 0.5, 0.3, 0.3);
    setupContext(2, 3);
    drawGrass(0.35, 0.5, 0.3, 0.3, YELLOW);
    setupContext(3, 3);
    random.setSeed(5);
    drawGrass(0.3, 0.5, 0.3, 0.64, BLUE);
    setupContext(4, 3);
    {
      // snowy tree
      random.setSeed(5);
      const t = new Tree();
      t.leafHue = 0.5;
      t.leafBrightness = 1.2;
      t.leafMaxSize = 0.04;
      t.branchRate = 300;
      t.lightPower = 0.01;
      t.flowerChance = 0.01;
      t.flowerColor = BLUE;
      t.draw();
    }
    setupContext(5, 3);
    {
      // yellow tree
      random.setSeed(9);
      const t = new Tree();
      t.leafHue = 0.13;
      t.leafBrightness = 0.5;
      t.leafSat = 0.9;
      t.multiBranch = 1;
      t.branchRate = 500;
      t.minBranchSize = 0.008;
      t.startWidth = 0.1;
      t.draw();
    }

    // track objects
    setupContext(0, 4);
    {
      // telephone pole
      const c = hsl(0.08, 0.4, 0.2);
      messyRect(0.5, 0.5, 0.04, 1, 0, c);
      messyRect(0.5, 0.06, 0.03, 0.2, PI / 2, c);
      messyRect(0.5, 0.12, 0.03, 0.2, PI / 2, c);
    }
    setupContext(1, 4);
    drawRock(); // tall rock
    setupContext(2, 4);
    {
      // big rocks
      drawRock(0.55, 0.08, 0.53, 0.015, 0.6, 0.7, 0.5);
      drawRock(0.4, 0.1, 0.45, 0.012, 0.3, 0.7);
      drawRock(0.6, 0.2, 0.2, 0.005, 0.4, 0.6);
    }
    setupContext(3, 4);
    for (
      let i = 39;
      i--; // small rocks

    ) {
      const y = 0.02;
      const z = random.float(0.002, 0.015);
      drawRock(
        0.5 + random.floatSign(0.45),
        random.float(0.005, 0.02),
        random.float(0.02, 0.05),
        0.005,
        0.4,
        0.3,
        0.3,
        y,
        z
      );
    }
    setupContext(4, 4);
    for (
      let i = 199;
      i--; // sand

    ) {
      const x = 0.5 + random.floatSign(0.45);
      const y = 0.03;
      const z = random.float(0.003, 0.006);
      const cHSL = vec3(0.13, 0.3, 0.7);
      drawRock(
        x,
        random.float(0.03),
        random.float(0.05),
        0.005,
        0.4,
        0.3,
        0.3,
        y,
        z,
        500,
        cHSL,
        0.4
      );
    }
    setupContext(5, 4);
    for (
      let i = 99;
      i--; // water

    ) {
      const p = i / 99;
      const w = 0.01;
      const x = lerp(p, 0.05, 0.95);
      const h = lerp(p, 0.02, 0.13);
      const cHSL = vec3(0.53, 1, 1);
      drawRock(x, w, h, 0.01, 0.3, 0.6, 0.5, 0, 0.01, 500, cHSL, 0.4 - p * 0.2);
    }
    setupContext(6, 4);
    {
      // tunnel
      drawRock(0.85, 0.05, 0.53, 0.002, 0.6, 0.7, 0.5, -0.1, 0.02, 1e3);
      drawRock(0.15, 0.05, 0.53, 0.002, 0.6, 0.7, 0.5, -0.1, 0.02, 1e3);
      drawRock(
        0.5,
        0.42,
        0.25,
        0.002,
        0.5,
        0.7,
        0.5,
        0.2,
        0.02,
        1e3,
        undefined,
        undefined,
        0
      );
    }
    setupContext(7, 4);
    {
      // tunnel 2
      color(hsl(0, 0, 1));
      rect(1, 1, 0.4, 0.5);
      rect(0, 1, 0.4, 0.5);
      color(hsl(0, 0, 0.7));
      rect(0.5, 0.75, 1, 0.15);
    }

    // road signs
    setupContext(0, 5); // turn left
    {
      drawSignBackground(0.5, 0.5, WHITE, BLACK, 0.05, GRAY, 0.3, 0.3, 1);
      color(BLACK);
      triangle(0.42, 0.5, 0.12, -PI / 2);
      context.lineWidth = 0.09;
      context.beginPath();
      context.arc(0.44, 0.7, 0.2, (PI * 3) / 2, PI * 2);
      context.stroke();
    }
    /*setupContext(1,5); // curvy road
        {
            drawSignBackground(.5,.5,WHITE,BLACK,.04,GRAY,.3,.3,1);
            
            color(BLACK);
            triangle(.5,.46,.12)
            for(let i=99; i--;)
            {
                const p = i/99;
                rect(.5-.1*Math.cos(p*10)*Math.sin(p*3)**2,.5+p/4,.09,.01);
            }
        }*/
    /*const warningColor = hsl(.14,1,.5);
        setupContext(0,5,1); // turn left
        {
            drawRoadSignBackground();
            color(BLACK);
            triangle(.44,.23,.07,-PI/2)
            context.lineWidth=.05;
            context.lineCap='butt';
            context.beginPath();
            context.arc(.47,.35,.12,PI*3/2,PI*2);
            context.stroke();
        }
        setupContext(1,5);
        {
            // curvy road
            drawRoadSignBackground();
            color(BLACK);
            triangle(.5,.18,.07)
            for(let i=99; i--;)
            {
                const p = i/99;
                rect(.5+.05*Math.cos(p*10)*Math.sin(p*3)**2,.22+p*.2,.04,.01);
            }
        }
        setupContext(2,5);
        {
            // big turn left
            drawSignBackground(.4,.5,warningColor,BLACK,.04,GRAY,.3,.3,1);
            color(BLACK);
            triangle(.53,.55,.17,-PI/2)
        }*/
    /*setupContext(2,5);
        {
            // warning
            drawSignBackground(.8,.3,WHITE,BLACK,.04,GRAY,.3,.4,1);
            color(BLACK);

            // set up clip
            const w=.79,h=.29;
            context.save();
            context.beginPath();
            context.rect(.5-w/2,.55-h/2,w,h);
            context.clip();//context.fill();

            for(let j=5; j--;)
            {
                const x=j*.18,y=.4,h2=.4;
                rectLine(x,y,x+h2,y+h2,.045);
            }
            context.restore();
        }*/
    /*setupContext(4,5);
        {
            // speed limit
            drawSignBackground(.35,.43,WHITE,BLACK,.04,GRAY,0,.03,1,.05);
            color(BLACK);
            text('SPEED',.5,.1,.08,1,0,undefined,undefined,600);
            text('LIMIT',.5,.185,.08,1,0,undefined,undefined,600);
            text(55,.5,.34,.24,1,0,undefined,undefined,600);
        }
        setupContext(5,5);
        {
            // interstate 13
            drawSignBackground(0,0,WHITE,BLACK,.04,GRAY,0,.1,1,.05);

            for(let k=2; k--;)
            for(let i=99; i--;)
            {
                color(k?WHITE:hsl(.6,.9,.4));
                const p = i/99;
                const w = k?.5:.47;
                const h = k?.6:.57;
                rect(.5,h-p*.5,w*Math.sin(p*2.2-.2)**.7,.01);
            }

            color(WHITE)
            rect(.5,.1,.5,.15)
            color(hsl(0,.7,.5))
            rect(.5,.1,.45,.1)
            
            color(WHITE)
            lineColor(WHITE)
            text('INTERSTATE',.5,.105,.1,.43,0,undefined,undefined,600);
            text(13,.48,.33,.3,1,.007);
        }*/

    // more stuff
    setupContext(0, 6);
    drawStartSign("GOAL");
    setupContext(1, 6);
    drawStartSign("START");
    /*setupContext(1,6);
        {
            // grave cross
            for(let i=2; i--;)
            {
                const o = i*.02;
                color(hsl(0,0,i?.1:1));
                rect(.5+o,.6,.08,.8);
                rect(.5+o,.4,.4,.08);
            }
        }*/
    setupContext(2, 6);
    {
      // grave stone
      for (let k = 2; k--; )
        for (let i = 9; i--; ) {
          const p = i / 9;
          color(hsl(0, 0, k ? 0.2 : 0.9));
          circle(0.5 + k * 0.05, 0.5 + p / 2, 0.3, 0.4);
        }
    }
    /*setupContext(2,6,1);
        {
            // grave stone
            drawRock(.5,.2,.7,0.003,.9,1,undefined,undefined,undefined,undefined,vec3(0,0,2));
        }*/
    setupContext(3, 6);
    if (js13kBuildLevel2) {
      // city building
      color(BLACK);
      rect(0.5, 0.57, 0.3, 1);
      for (let i = 19; i--; )
        rect(0.5 + random.floatSign(0.15), random.float(0.5, 0.6), i / 2e3, 1);

      for (let j = 30; j--; )
        for (let i = 9; i--; ) {
          const w = 0.03;
          const x = 0.38 + i * w;
          const y = 0.1 + j * w;
          color(
            hsl(
              random.float(0.07, 0.15),
              random.float(0.5, 1),
              (i & j) % 2 ? 0 : random.float(0.3, 1) ** 3
            )
          );
          rect(x, y, w * 0.7, w * 0.7);
        }
    } else {
      // y flippable city building
      color(BLACK);
      for (let i = 19; i--; ) {
        const p = i / 19;
        const h = lerp(p, 0.9, 0.86);
        rect(lerp(p, 0.36, 0.64), 0.07 + h / 2, 0.03, h);
        rect(
          0.5 - random.floatSign(0.14),
          0.5,
          random.float(0.02),
          random.float(0.85, 1)
        );
      }

      for (let j = 28; j--; )
        for (let i = 9; i--; ) {
          const w = 0.03;
          const x = 0.372 + i * w;
          const y = 0.1 + j * w;
          color(
            hsl(
              random.float(0.07, 0.15),
              random.float(0.5, 1),
              (i & j) % 2 ? 0 : random.float(0.3, 1) ** 3
            )
          );
          rect(x, y, w * 0.7, w * 0.7);
        }
    }

    /*setupContext(5,6);
        {
            // green mountains
            random.setSeed(43);
            drawRock(.5,.1,.35,.03,.4,1, 1,undefined,undefined,undefined,vec3(.35,.4,.5),.3);
            drawRock(.5,.1,.08,.2,.4,1, 1,-.05,undefined,undefined,vec3(.1,.4,.5),.3);
            //messyRect(.5,1,.1,1,PI/2,hsl(.6,1,.7));
        }*/
    setupContext(6, 6);
    {
      // dunes
      random.setSeed(9);
      drawRock(
        0.5,
        0,
        0.25,
        0.04,
        0.5,
        1,
        1,
        -0.1,
        undefined,
        1e3,
        vec3(0, 0, 0.7),
        0.7
      );
    }
    setupContext(7, 6);
    {
      // background mountains
      drawRock(
        0.45,
        0.1,
        0.5,
        0.025,
        0.3,
        0.7,
        0.8,
        undefined,
        undefined,
        undefined,
        vec3(0, 0, 0.7),
        0.7
      );
      drawRock(
        0.7,
        0.1,
        0.25,
        0.02,
        0.3,
        0.8,
        undefined,
        undefined,
        undefined,
        undefined,
        vec3(0, 0, 0.7),
        0.6
      );
    }
    /*setupContext(1,6);
        {
            // road noise
            for(let i=9; i--;)
            for(let j=200; j--;)
            {
                color(hsl(0,0,random.float(.9,1)));
                rect(i/9,j/200,.3,.02);
            }
        }*/

    //setupContext(0,6);
    //drawGirders();
    //setupContext(1,6);
    //drawGirders(-.05,1);

    /*function drawGirders(o=.01,lit=.8)
        {
            // girders
            for(let i=3; i--;)
            {
                lineColor(hsl(0,0,lit-i/3));
                const x = .5+i*.01;
                const lw = .02;
                const w = .1;
                for(let i=9; i--;)
                for(let j=2; j--;)
                {
                    const k = j?1:-1;
                    const x1 = x-k*w;
                    const y1 = i*.2;
                    const x2 = x+k*w;
                    const y2 = (i+1)*.2;
                    line(x1,y1,x2,y2,lw);
                }
                const w2 = w+o;
                line(x-w2,0,x-w2,1,lw);
                line(x+w2,0,x+w2,1,lw);
            }
        }*/

    /*function drawRoadSignBackground()
        {
            const y = .28;
            color(hsl(0,0,.1));
            rect(.51,.9,.04,1);
            color(GRAY);
            rect(.5,.9,.04,1);
            color(warningColor);
            rect(.5,y,.36,.36,PI/4);
            color(BLACK);
            rect(.5,y,.33,.33,PI/4);
            color(warningColor);
            rect(.5,y,.3,.3,PI/4);
        }*/
  }
  if (hardAlpha) {
    // make hard alpha
    const minAlpha = 99;
    const s = generativeCanvasSize;
    const imageData = context.getImageData(0, generativeTileSize, s, s);
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4)
      data[i] = data[i] < minAlpha ? 0 : 255;
    context.putImageData(imageData, 0, generativeTileSize);
  }

  function setupContext(x, y, test) {
    if (debug && test) {
      debugTile = vec3(x, y);
      debugGenerativeCanvas = 1;
    }
    // set context transform to go from 0-1 to 0-size
    const b = bleedPixels;
    const w = generativeTileSize;
    context.restore();
    context.save();
    context.setTransform(w - 2 * b, 0, 0, w - 2 * b, w * x + b, w * y + b);
    context.beginPath();
    context.rect(0, 0, 1, 1);
    context.clip();
  }

  function circle(x, y, r, a1 = 0, a2 = 9) {
    ellipse(x, y, r, r, 0, a1, a2);
  }
  function rect(x = 0.5, y = 0.5, w = 1, h = 1, angle = 0) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillRect(-w / 2, -h / 2, w, h);
    context.restore();
  }
  function color(c = WHITE, setLineColor = 0) {
    ASSERT(isColor(c));
    context.fillStyle = c;
    if (setLineColor) lineColor(c);
  }
  function lineColor(c = WHITE) {
    ASSERT(isColor(c));
    context.strokeStyle = c;
  }
  function ellipse(x = 0.5, y = 0.5, w = 0.5, h = 0.5, a = 0, a1 = 0, a2 = 9) {
    context.beginPath();
    context.ellipse(x, y, max(0, w), max(0, h), a, a1, a2);
    context.fill();
  }
  function rectLine(x1, y1, x2, y2, w = 0.1, density = 200) {
    const d = (vec3(x2 - x1, y2 - y1).length() * density + 1) | 0;
    for (let i = d; i--; ) rect(lerp(i / d, x1, x2), lerp(i / d, y1, y2), w, w);
  }
  function rectOutline(x = 0.5, y = 0.5, w = 1, h = 1, l = 0.05) {
    context.lineWidth = l;
    context.strokeRect(x - w / 2, y - h / 2, w, h);
  }
  function line(x1, y1, x2, y2, w = 0.1) {
    context.lineWidth = w;
    context.beginPath();
    context.lineTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }
  function triangle(x = 0.5, y = 0.5, r = 0.5, ao = 0) {
    context.beginPath();
    for (let i = 3; i--; ) {
      const a = ((i * 2) / 3) * PI;
      context.lineTo(x + r * Math.sin(a + ao), y - r * Math.cos(a + ao));
    }
    context.fill();
  }
  /*function polygon(x=.5, y=.5, r=.5, ao=0,sides=3)
    {
        context.beginPath();
        for(let i=sides; i--;)
        {
            const a = i/sides*PI*2;
            context.lineTo(x+r*Math.sin(a+ao), y-r*Math.cos(a+ao));
        }
        context.fill();
    }*/
  function text(
    s,
    x = 0.5,
    y = 0.5,
    size = 1,
    width = 0.95,
    lineWidth = 0,
    font = "arial",
    textAlign = "center",
    weight = 400,
    style = ""
  ) {
    if (fixFirefoxFontBug) {
      // fix firefox rendering big
      // it will not render fonts below minimum size
      context.save();
      const sizeFix = 0.05;
      context.scale(sizeFix, sizeFix);
      size /= sizeFix;
      x /= sizeFix;
      y /= sizeFix;
      width /= sizeFix;
      lineWidth /= sizeFix;
    }

    context.font = `${style} ${weight} ${size}px ${font}`;
    context.textBaseline = "middle";
    context.textAlign = textAlign;
    context.lineWidth = lineWidth;
    context.lineCap = context.lineJoin = "round";
    lineWidth && context.strokeText(s, x, y, width);
    context.fillText(s, x, y, width);

    if (fixFirefoxFontBug) context.restore();
  }

  function messyRect(x, y, w, h, angle, c, density = 300, shardSize = 0.1) {
    color(c);
    rect(x, y, w, h, angle);
    const count = w * density;
    for (let i = count + 1; i--; ) {
      const w2 = random.float(w * shardSize);
      const ow = random.floatSign(w - w2);
      const d1 = vec3(1, 0)
        .rotateZ(angle)
        .scale(ow / 2);
      color(random.mutateColor(c, 0.05, 0.7));

      const h2 = random.float(h / 4, h);
      const oh = random.floatSign(h - h2);
      const d2 = vec3(0, 1)
        .rotateZ(angle)
        .scale(oh / 2);
      const d = d1.add(d2);
      rect(x + d.x, y + d.y, w2, h2, angle);
    }
  }

  function drawRock(
    x = 0.5,
    w = 0.1,
    hstart = 0.7,
    wdelta = 0.01,
    cornerX = 0.7,
    cornerY = 0.7,
    cornerAngle = 0.3,
    y = 0,
    z = 0.03,
    density = 520,
    colorVecHSL = vec3(0, 0, 1),
    addLit = 0,
    randomness = 0.01
  ) {
    for (
      let jcount = max(1, density * hstart * 0.1), j = jcount;
      j-- > 0;
      w += random.float(wdelta)
    )
      for (
        let icount = density * w, i = icount, dh = 0, h = hstart;
        i-- > 0;

      ) {
        const p = i / icount;
        const pj = j / jcount;
        let l = random.float(0.2, 0.5);
        if (pj < abs(cornerX - p) / 20) l = random.float(0.2); // dark on bottom

        if (random.bool(0.05)) l = random.float(1); // random bright spot
        else if (pj > cornerY + abs(cornerX - p) * cornerAngle)
          l *= 2; // bright on top
        else if (p > cornerX) l /= 3; // darker on right side

        const zz = random.float(z, z * 2);
        h += dh = -sign(dh) * random.float(randomness);

        const c2 = colorVecHSL.copy();
        c2.z = l * c2.z + addLit;
        const c = c2.getHSLColor(0.3);

        color(c);
        rect(
          x + lerp(p, -w, w),
          1 - pj * h - y - zz + random.floatSign(randomness),
          zz,
          zz,
          random.floatSign(2)
        );
      }
  }

  function drawPalmTree() {
    const p = new Particle(0.3, 0.29, 0.3, 0.5, 0.5, 0.02, 0.06);
    p.color = hsl(0.1, 0.5, 0.1);
    p.colorRandom = 0.1;
    p.draw();

    for (let j = 12; j--; ) {
      const v = 0.3,
        a = (j / 12) * 2 * PI;
      const vx = Math.sin(a) * v,
        vy = Math.cos(a) * v;
      const p = new Particle(0.3, 0.23, vx, vy - 0.1, 0.2, 0.05, 0.005);
      p.style = 1;
      p.color = hsl(0.3, 0.6, random.float(0.3, 0.5));
      p.colorRandom = 0.1;
      p.draw();
    }
  }

  function drawFlower(pos, flowerPetals, flowerSize, c = RED) {
    const flowerAngle = random.float(2 * PI);
    const regularity = 1 + random.floatSign(0.08);
    flowerSize = random.float(flowerSize * 0.6, flowerSize);
    color(random.mutateColor(WHITE, 0.2));
    circle(pos.x, pos.y, flowerSize * random.float(0.5, 1));
    c = random.mutateColor(c, 0.3);
    for (let i = flowerPetals; i--; ) {
      const a = (i / flowerPetals) * PI * 2 + flowerAngle;
      const pos2 = pos.add(vec3(flowerSize / 0.8, 0).rotateZ(a));
      color(random.mutateColor(c, 0.2));
      ellipse(pos2.x, pos2.y, flowerSize, flowerSize / 2, a ** regularity);
    }
  }

  function drawGrass(h = 0, s = 0, l = 0.6, flowerChance = 0, flowerColor) {
    const flowerPetals = random.int(5, 9);
    const flowerSize = random.float(0.03, 0.05);
    for (let i = 70; i--; ) {
      const x = 0.5 + random.floatSign(0.25);
      const p = new Particle(
        x,
        1,
        random.floatSign(0.25),
        random.floatSign(-0.6, -1),
        0.5,
        0.02
      );
      p.color = hsl(h, s, l + random.float(0.4));
      p.iterations = 99;
      const pos = p.draw();
      if (random.bool(flowerChance))
        drawFlower(pos, flowerPetals, flowerSize, flowerColor);
    }
  }

  function drawSignBackground(
    w = 1,
    h = 0.9,
    c = hsl(0, 0, 0.1),
    outlineColor = WHITE,
    outline = 0.05,
    legColor = outlineColor,
    legSeparation = 0.2,
    yo = 0,
    doubleOutline = 0,
    legWidth = 0.1
  ) {
    for (let i = 2; i--; ) {
      color(i ? hsl(0, 0, 0.1) : legColor);
      rect(0.5 - legSeparation * w + 0.01 * i, 0.5 + yo, legWidth);
      rect(0.5 + legSeparation * w + 0.01 * i, 0.5 + yo, legWidth);
    }
    color(c);
    doubleOutline && rect(0.5, h / 2 + yo, w + outline, h + outline);
    color(outlineColor);
    rect(0.5, h / 2 + yo, w, h);
    color(c);
    rect(0.5, h / 2 + yo, w - outline, h - outline);
  }

  function drawJS13kSign() {
    drawSignBackground();
    color(WHITE, 1);
    text("JS", 0.25, 0.27, 0.5, 0.35, 0.02, "courier");
    text("GAMES", 0.5, 0.66, 0.5, 0.9, 0.02, "courier");
    color(hsl(1, 0.8, 0.5), 1);
    text("13K", 0.67, 0.27, 0.5, 0.5, 0.02, "courier");
  }
  function drawDwitterSign() {
    drawSignBackground(1, 0.6, WHITE, BLACK);
    color(BLACK, 1);
    text("dwitter.net", 0.5, 0.18, 0.2, 0.9, 0.01, "courier");
    const w = 0.04;
    for (let i = 9; i--; ) rect(0.18 + i * w * 2, 0.4, w, w * 4);
  }
  function drawAvalancheSign() {
    const c = hsl(0, 0.9, 0.6);
    drawSignBackground(0.9, 0.9, WHITE, hsl(0, 0, 0.2));
    color(c, 1);
    const y = 0.37;
    circle(0.5, y, 0.32);
    text("AVALANCHE", 0.5, 0.8, 0.13, 1, 0.003);
    color(WHITE);
    triangle(0.5, y, 0.23);
    const r = 0.15;
    const ry = 0.26; //r*Math.sin(PI/3)*2;
    const x = 0.47;
    color(c);
    rectLine(x, y + 0.15, x + r, y + 0.15 - ry, 0.07);
  }

  function drawGenericSign() {
    drawSignBackground(1, size + 0.1, c2, c1, undefined, c3);
    color(c1, 1);
    text(
      t,
      0.5,
      (size + 0.15) / 2,
      size,
      0.8 + lineWidth * 10,
      lineWidth,
      font
    );
  }

  function drawGitHubSign() {
    drawSignBackground(1, 0.4, WHITE, BLACK);
    color(BLACK, 1);
    text("GitHub", 0.5, 0.22, 0.3, 0.9, 0.01);
  }

  function drawOPSign() {
    drawSignBackground(1, 0.6, WHITE, BLACK);

    const x = 0.28;
    const y = 0.3;
    const w = 0.08;
    const h = 0.4;
    const x2 = 0.81;
    color(hsl(0.65, 0.9, 0.45));
    circle(x, y, 0.2);
    rect(0.58, y, w, h);

    rect(0.71, 0.14, 0.22, w);
    rect(0.75, y, 0.13, w);
    circle(x2, 0.22, 0.12, 4.7, 7.9);

    color(WHITE);
    circle(x, y, 0.12);
    circle(x2, 0.22, 0.04);
  }

  function drawZZFXSign() {
    const t = "ZZFX";
    drawSignBackground(1, 0.6, BLACK, hsl(0, 0, 0.2));
    color(hsl(0.6, 1, 0.5), 1);
    const x = 0.47,
      y = 0.38,
      o = 0.03;
    text(t, x, y, 0.55, 0.8, 0.05);
    color(YELLOW, 1);
    text(t, x + o, y - o, 0.55, 0.8, 0.05);
    color(hsl(0.96, 1, 0.5), 1);
    text(t, x + 2 * o, y - 2 * o, 0.55, 0.8, 0.05);
  }

  function drawHarrisSign() {
    const c = hsl(0.6, 0.9, 0.3);
    drawSignBackground(1, 0.6, c, WHITE, 0.05, BLACK, 0.5);
    color(WHITE, 1);
    text("HARRIS", 0.5, 0.24, 0.31, 0.85, 0.01);
    text("WALZ", 0.5, 0.46, 0.2, 0.8, 0.01);
  }
  function drawDoubleLineSign(
    t1,
    t2,
    c,
    legSeparation = 0.5,
    y1 = 0.24,
    y2 = 0.46
  ) {
    drawSignBackground(1, 0.6, c, WHITE, 0.05, BLACK, legSeparation);
    color(WHITE, 1);
    text(t1, 0.5, y1, 0.31, 0.85, 0.01);
    text(t2, 0.5, y2, 0.2, 0.8, 0.01);
  }

  function drawLittleJSSign() {
    drawSignBackground(1, 0.7, WHITE, BLACK, 0.05, WHITE, 0);
    ljsText("LittleJS", 0.05, 0.25);
    ljsText("Engine", 0.11, 0.5, 2);
    function ljsText(t, x, y, o = 0) {
      for (let i = 0; i < t.length; ++i) {
        const weight = 900,
          fontSize = 0.21,
          font = "arial";
        context.font = `${weight} ${fontSize}px ${font}`;
        const w = context.measureText(t[i]).width;
        color(hsl([1, 0.3, 0.57, 0.14][(i + o) % 4], 0.9, 0.5));
        text(t[i], x + w / 2, y, fontSize, 1, 0.03, font, undefined, weight);
        text(t[i], x + w / 2, y, fontSize, 1, 0, font, undefined, weight);
        x += w;
      }
    }
  }

  function drawStartSign(t) {
    rect(0.5, 0.58, 1, 0.16);
    const c = hsl(0.08, 0.4, 0.2);
    const w = 0.06;
    messyRect(w / 2, 0.75, w, 0.53, 0, c);
    messyRect(1 - w / 2, 0.75, w, 0.53, 0, c);
    color(RED);
    text(t, 0.5, 0.6, 0.15, 1, 0.01, undefined, undefined, 600);
  }

  function drawCheckpointSign(side) {
    color(BLACK);
    rect(0.5 - side * 0.45, 0.5, 0.1);
    color(hsl(0, 0, 0.2));
    rect(0.49 - side * 0.45, 0.5, 0.1);
    color(WHITE);
    rect(0.5, 0, 1, 0.5);
    color(hsl(0.3, 0.7, 0.5));
    text("CHECK", 0.5, 0.14, 0.22, 0.95, 0.02, undefined, undefined, 600);
  }

  function drawLicensePlate() {
    color(hsl(0, 0, 0.8));
    rect();
    color(hsl(0.7, 0.9, 0.25), 1);
    text("JS-13K", 0.5, 0.6, 1, 0.9, 0.03, "monospace");
  }
}

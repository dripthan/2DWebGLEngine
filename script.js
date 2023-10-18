
// --------------------------------------------------------------------- shaders

const vsSource = `#version 300 es
precision highp float;

layout(location = 0) in vec2 vPosition;
layout(location = 1) in float vScale;
layout(location = 2) in vec3 vColor;
out vec3 fColor;

uniform float uCanvasWidth;
uniform float uCanvasHeight;

void main()
{
  float x = (vPosition.x / uCanvasWidth - 0.5) * 2.f;
  float y = -(vPosition.y / uCanvasHeight - 0.5) * 2.f;
  gl_Position = vec4(x, y, 0.f, 1.f);
  gl_PointSize = vScale;
  fColor = vColor;
}

`;

const fsSource = `#version 300 es
precision highp float;

in vec3 fColor;
out vec4 finalColor;

void main()
{
  finalColor = vec4(fColor, 1.f);
}

`;

// --------------------------------------------------------------------- functions

// https://www.30secondsofcode.org/js/s/hsl-to-rgb/

const HSLToRGB = (h, s, l) => {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
};

// --------------------------------------------------------------------- global variables

const MAX_PARTICLES = 1000000;
const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl2');
const mouse = { x: 0, y: 0, down: false };

// --------------------------------------------------------------------- particle variables

const positionsArray = new Float32Array(MAX_PARTICLES * 2);
const scalesArray = new Float32Array(MAX_PARTICLES);
const colorsArray = new Float32Array(MAX_PARTICLES * 3);
let parts = [];

// --------------------------------------------------------------------- shader

const program = gl.createProgram();
[
  { type: gl.VERTEX_SHADER, source: vsSource },
  { type: gl.FRAGMENT_SHADER, source: fsSource }
]
.forEach(({type, source}) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.log(gl.getShaderInfoLog(shader));
  gl.attachShader(program, shader);
  gl.deleteShader(shader);
});
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.log(gl.getProgramInfoLog(program));

// --------------------------------------------------------------------- model buffers

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(0, 1);
gl.bindBuffer(gl.ARRAY_BUFFER, null);

const sizeBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(1, 1);
gl.bindBuffer(gl.ARRAY_BUFFER, null);

const colorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
gl.vertexAttribDivisor(2, 1);
gl.bindBuffer(gl.ARRAY_BUFFER, null);

gl.bindVertexArray(null);

// --------------------------------------------------------------------- loop

gl.clearColor(0.0, 0.0, 0.0, 1.0);

const loop = () => {

  // ------------------------------------------------------------------- add particles

  if (mouse.down) {
    for (let i = 0; i < 100; i += 1) {
      parts.push({
        pos: [mouse.x, mouse.y],
        vel: [Math.random() * Math.PI * 2, 5],
        acc: [Math.random() * 0.05, Math.random() * -0.1],
        sca: 15,
        gro: Math.random() * -0.1 - 0.1,
        hue: Date.now() * 0.1,
        chr: 3
      });
    }
  }

  // ------------------------------------------------------------------- update particles

  for (let i = parts.length - 1; i >= 0; --i) {
    const p = parts[i];
    p.pos[0] += Math.cos(p.vel[0]) * p.vel[1];
    p.pos[1] += Math.sin(p.vel[0]) * p.vel[1];
    p.vel[0] += p.acc[0];
    p.vel[1] += p.acc[1];
    p.sca += p.gro;
    p.hue += p.chr;
  }

  // ------------------------------------------------------------------- remove particles

  parts = parts.filter(({pos, sca}) => (
    pos[0] > 0 &&
    pos[1] > 0 &&
    pos[0] < canvas.width &&
    pos[1] < canvas.height &&
    sca > 0
  ));

  // ------------------------------------------------------------------- upload particle data to matrices

  for (let i = 0; i < parts.length; i++) {
    for (let j = 0; j < 2; j++) {
      positionsArray[i * 2 + j] = parts[i].pos[j];
    }
  }
  for (let i = 0; i < parts.length; i++) {
    scalesArray[i] = parts[i].sca;
  }
  for (let i = 0; i < parts.length; i++) {
    const color = HSLToRGB(parts[i].hue, 100, 50);
    for (let j = 0; j < 3; j++) {
      colorsArray[i * 3 + j] = color[j];
    }
  }

  // ------------------------------------------------------------------- rendering

  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);

  gl.uniform1f(gl.getUniformLocation(program, 'uCanvasWidth'), canvas.width);
  gl.uniform1f(gl.getUniformLocation(program, 'uCanvasHeight'), canvas.height);

  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  gl.enableVertexAttribArray(1);
  gl.enableVertexAttribArray(2);

  // ------------------------------------------------------------------- upload matrices to shaders

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positionsArray, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, scalesArray, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colorsArray, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // ------------------------------------------------------------------- draw all instances

  gl.drawArraysInstanced(gl.POINTS, 0, 1, parts.length);

  gl.disableVertexAttribArray(2);
  gl.disableVertexAttribArray(1);
  gl.disableVertexAttribArray(0);
  gl.bindVertexArray(null);
  gl.useProgram(null);

  requestAnimationFrame(loop);
};

// ------------------------------------------------------------------- events

addEventListener('load', () => {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
  requestAnimationFrame(loop);
});

addEventListener('resize', () => {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
});

addEventListener('mousemove', ({x, y}) => {
  mouse.x = x;
  mouse.y = y;
});

addEventListener('mousedown', () => mouse.down = true);
addEventListener('mouseup', () => mouse.down = false);

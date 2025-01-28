// Boilerplate code for creating a WebGL program
function createProgram(gl, vertexShaderText, fragmentShaderText) {
  const program = gl.createProgram();

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderText);
  gl.compileShader(vertexShader);
  gl.attachShader(program, vertexShader);

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderText);
  gl.compileShader(fragmentShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);


  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  return program;
}

// Matrix creation helpers
function createOrtho(bottom, top, left, right, near, far) {
  return new DOMMatrix([
    2 / (right - left), 0, 0, 0,
    0, 2 / (top - bottom), 0, 0,
    0, 0, -2 / (far - near), 0,
    -(right + left) / (right - left), -(top + bottom) / (top - bottom), -(far + near) / (far - near), 1,
  ]);
}

function createPerspective(fov, aspect, near, far) {
  const f = Math.tan(Math.PI * 0.5 - 0.5 * fov);
  const rangeInv = 1.0 / (near - far);

  return new DOMMatrix([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0
  ]);
}

function createLookAt(position, target, up = { x: 0, y: 1, z: 0}) {
  const zAxis = normalize(subtractVectors(target, position));
  const xAxis = normalize(crossVectors(zAxis, up));
  const yAxis = crossVectors(xAxis, zAxis);

  const invertedZ = new DOMPoint(zAxis.x * -1, zAxis.y * -1, zAxis.z * -1);

  return new DOMMatrix([
    xAxis.x, yAxis.x, invertedZ.x, 0,
    xAxis.y, yAxis.y, invertedZ.y, 0,
    xAxis.z, yAxis.z, invertedZ.z, 0,
    -dotVectors(xAxis, position), -dotVectors(yAxis, position), -dotVectors(invertedZ, position), 1,
  ]);
}

// Vector math helpers
function subtractVectors(v1, v2) {
  return new DOMPoint(v1.x - v2.x, v1.y - v2.y, v1.z - v2.z);
}

function crossVectors(v1, v2) {
  const x = v1.y * v2.z - v1.z * v2.y;
  const y = v1.z * v2.x - v1.x * v2.z;
  const z = v1.x * v2.y - v1.y * v2.x;
  return new DOMPoint(x, y, z);
}

function dotVectors(v1, v2) {
  return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

function normalize(v1) {
  const magnitude = getMagnitudeVector(v1);
  if (magnitude === 0) {
    return new DOMPoint();
  }

  return new DOMPoint(v1.x / magnitude, v1.y / magnitude, v1.z / magnitude);
}

function getMagnitudeVector(v1) {
  return Math.hypot(v1.x, v1.y, v1.z);
}

// Non elegant but very simple way of drawing a multi colored cube at a given size and position
function createMultiColorCube(width, height, depth, x, y, z) {
  return new Float32Array([
    //    X           Y          Z         R G B
    -width + x,-height + y,-depth + z,   0,1,1,
    -width + x, height + y, depth + z,   0,1,1,
    -width + x, height + y,-depth + z,   0,1,1,
    -width + x, -height + y, depth + z,   0,1,1,
    -width + x, height + y, depth + z,   0,1,1,
    -width + x,-height + y,-depth + z,   0,1,1,

    width + x ,-height + y,-depth + z,   1,0,1,
    width + x , height + y,-depth + z,   1,0,1,
    width + x , height + y, depth + z,   1,0,1,
    width + x , height + y, depth + z,   1,0,1,
    width + x ,-height + y, depth + z,   1,0,1,
    width + x ,-height + y,-depth + z,   1,0,1,

    -width + x,-height + y,-depth + z,   0,1,0,
    width + x,-height + y,-depth + z,   0,1,0,
    width + x,-height + y, depth + z,   0,1,0,
    width + x,-height + y, depth + z,   0,1,0,
    -width + x,-height + y, depth + z,   0,1,0,
    -width + x,-height + y,-depth + z,   0,1,0,

    -width + x, height + y,-depth + z,   1,1,0,
    width + x, height + y, depth + z,   1,1,0,
    width + x, height + y,-depth + z,   1,1,0,
    -width + x, height + y, depth + z,   1,1,0,
    width + x, height + y, depth + z,   1,1,0,
    -width + x, height + y,-depth + z,   1,1,0,

    width + x,-height + y,-depth + z,   0,0,1,
    -width + x,-height + y,-depth + z,   0,0,1,
    width + x, height + y,-depth + z,   0,0,1,
    -width + x, height + y,-depth + z,   0,0,1,
    width + x, height + y,-depth + z,   0,0,1,
    -width + x,-height + y,-depth + z,   0,0,1,

    -width + x,-height + y, depth + z,   1,0,0,
    width + x,-height + y, depth + z,   1,0,0,
    width + x, height + y, depth + z,   1,0,0,
    width + x, height + y, depth + z,   1,0,0,
    -width + x, height + y, depth + z,   1,0,0,
    -width + x,-height + y, depth + z,   1,0,0,
  ]);
}

// Non elegant but very simple way of drawing a multi colored cube at a given size and position
function createCubeWithNormals(width, height, depth, x, y, z) {
  return new Float32Array([
    //    X           Y          Z         Normal
    -width + x,-height + y,-depth + z,   -1,0,0,
    -width + x, height + y, depth + z,   -1,0,0,
    -width + x, height + y,-depth + z,   -1,0,0,
    -width + x, -height + y, depth + z,   -1,0,0,
    -width + x, height + y, depth + z,   -1,0,0,
    -width + x,-height + y,-depth + z,   -1,0,0,

    width + x ,-height + y,-depth + z,   1,0,0,
    width + x , height + y,-depth + z,   1,0,0,
    width + x , height + y, depth + z,   1,0,0,
    width + x , height + y, depth + z,   1,0,0,
    width + x ,-height + y, depth + z,   1,0,0,
    width + x ,-height + y,-depth + z,   1,0,0,

    -width + x,-height + y,-depth + z,   0,-1,0,
    width + x,-height + y,-depth + z,   0,-1,0,
    width + x,-height + y, depth + z,   0,-1,0,
    width + x,-height + y, depth + z,   0,-1,0,
    -width + x,-height + y, depth + z,   0,-1,0,
    -width + x,-height + y,-depth + z,   0,-1,0,

    -width + x, height + y,-depth + z,   0,1,0,
    width + x, height + y, depth + z,   0,1,0,
    width + x, height + y,-depth + z,   0,1,0,
    -width + x, height + y, depth + z,   0,1,0,
    width + x, height + y, depth + z,   0,1,0,
    -width + x, height + y,-depth + z,   0,1,0,

    width + x,-height + y,-depth + z,   0,0,-1,
    -width + x,-height + y,-depth + z,   0,0,-1,
    width + x, height + y,-depth + z,   0,0,-1,
    -width + x, height + y,-depth + z,   0,0,-1,
    width + x, height + y,-depth + z,   0,0,-1,
    -width + x,-height + y,-depth + z,   0,0,-1,

    -width + x,-height + y, depth + z,   0,0,1,
    width + x,-height + y, depth + z,   0,0,1,
    width + x, height + y, depth + z,   0,0,1,
    width + x, height + y, depth + z,   0,0,1,
    -width + x, height + y, depth + z,   0,0,1,
    -width + x,-height + y, depth + z,   0,0,1,
  ]);
}

//randFloat helper
function getRandomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function createSphere(radius, segments, positionX, positionY, positionZ) {
  const vertices = [];
  const indices = [];
  
  for (let lat = 0; lat <= segments; lat++) {
    const theta = (lat * Math.PI) / segments;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= segments; lon++) {
      const phi = (lon * 2 * Math.PI) / segments;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = radius * cosPhi * sinTheta + positionX;
      const y = radius * cosTheta + positionY;
      const z = radius * sinPhi * sinTheta + positionZ;

      const nx = cosPhi * sinTheta;
      const ny = cosTheta;
      const nz = sinPhi * sinTheta;

      vertices.push(x, y, z, nx, ny, nz);

      if (lat < segments && lon < segments) {
        const first = lat * (segments + 1) + lon;
        const second = first + segments + 1;

        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }
  }

  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}
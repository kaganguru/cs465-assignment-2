// ============================================================================
// CS465 Robot Animation - WebGL Application
// ============================================================================

// Global state
const state = {
    gl: null,
    canvas: null,
    shaderProgram: null,
    pickingShaderProgram: null,
    models: {},
    textures: {},
    camera: {
        distance: 15,
        theta: 0.5,
        phi: 0.5,
        target: [0, 0, 0],
        isDragging: false,
        isPanning: false,
        lastX: 0,
        lastY: 0,
        hasMoved: false
    },
    animation: {
        isPlaying: false,
        currentTime: 0, // 0-1 (percentage)
        duration: 5.0,  // seconds
        keyframes: {}   // partName -> [{time, translation, rotation}]
    },
    selectedKeyframe: null, // {partName, keyframeIndex}
    selectedPart: null, // For 3D picking
    matrixStack: [],
    pickingEnabled: false,
    pickingFramebuffer: null,
    pickingTexture: null,
    pickingDepthBuffer: null,
    gizmo: {
        visible: false,
        position: [0, 0, 0],
        mode: 'translate', // 'translate' or 'rotate'
        selectedAxis: null, // 'x', 'y', 'z', or null
        isDragging: false,
        dragStart: { x: 0, y: 0 },
        initialValue: null
    }
};

// Body part definitions
const PARTS = [
    'Body',
    'Head',
    'UpperLegFL',
    'LowerLegFL',
    'UpperLegFR',
    'LowerLegFR',
    'UpperLegBL',
    'LowerLegBL',
    'UpperLegBR',
    'LowerLegBR'
];

// Default transforms for each part
const DEFAULT_TRANSFORMS = {
    'Body': { translation: [0, 1.0, 0], rotation: [0, 0, 0] },
    'Head': { translation: [0, 0.8, 0.6], rotation: [0, 0, 0] },
    'UpperLegFL': { translation: [-0.5, -1.4, 0.5], rotation: [0, 0, 0] },
    'LowerLegFL': { translation: [0, -0.05, 0], rotation: [0, 0, 0] },
    'UpperLegFR': { translation: [0.5, -1.4, 0.5], rotation: [0, 0, 0] },
    'LowerLegFR': { translation: [0, -0.05, 0], rotation: [0, 0, 0] },
    'UpperLegBL': { translation: [-0.5, -1.4, -0.5], rotation: [0, 0, 0] },
    'LowerLegBL': { translation: [0, -0.05, 0], rotation: [0, 0, 0] },
    'UpperLegBR': { translation: [0.5, -1.4, -0.5], rotation: [0, 0, 0] },
    'LowerLegBR': { translation: [0, -0.05, 0], rotation: [0, 0, 0] }
};

// ============================================================================
// Utility Functions - Vector and Matrix Math
// ============================================================================

const vec3 = {
    create: () => [0, 0, 0],
    clone: (a) => [a[0], a[1], a[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    subtract: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    normalize: (a) => {
        const len = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
        return len > 0 ? [a[0] / len, a[1] / len, a[2] / len] : [0, 0, 0];
    },
    cross: (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
};

const mat4 = {
    create: () => [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ],
    
    identity: (out) => {
        out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
        out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
        out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
        out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
        return out;
    },
    
    clone: (a) => [...a],
    
    multiply: (out, a, b) => {
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
        
        const b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
        const b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
        const b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
        const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];
        
        out[0] = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30;
        out[1] = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31;
        out[2] = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32;
        out[3] = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33;
        
        out[4] = a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30;
        out[5] = a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31;
        out[6] = a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32;
        out[7] = a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33;
        
        out[8] = a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30;
        out[9] = a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31;
        out[10] = a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32;
        out[11] = a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33;
        
        out[12] = a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30;
        out[13] = a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31;
        out[14] = a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32;
        out[15] = a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33;
        
        return out;
    },
    
    translate: (out, a, v) => {
        const x = v[0], y = v[1], z = v[2];
        out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
        out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
        out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
        out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
        out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
        out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
        out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
        return out;
    },
    
    rotateX: (out, a, rad) => {
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        
        out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
        out[4] = a10 * c + a20 * s;
        out[5] = a11 * c + a21 * s;
        out[6] = a12 * c + a22 * s;
        out[7] = a13 * c + a23 * s;
        out[8] = a20 * c - a10 * s;
        out[9] = a21 * c - a11 * s;
        out[10] = a22 * c - a12 * s;
        out[11] = a23 * c - a13 * s;
        out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
        return out;
    },
    
    rotateY: (out, a, rad) => {
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        
        out[0] = a00 * c - a20 * s;
        out[1] = a01 * c - a21 * s;
        out[2] = a02 * c - a22 * s;
        out[3] = a03 * c - a23 * s;
        out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
        out[8] = a00 * s + a20 * c;
        out[9] = a01 * s + a21 * c;
        out[10] = a02 * s + a22 * c;
        out[11] = a03 * s + a23 * c;
        out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
        return out;
    },
    
    rotateZ: (out, a, rad) => {
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        
        out[0] = a00 * c + a10 * s;
        out[1] = a01 * c + a11 * s;
        out[2] = a02 * c + a12 * s;
        out[3] = a03 * c + a13 * s;
        out[4] = a10 * c - a00 * s;
        out[5] = a11 * c - a01 * s;
        out[6] = a12 * c - a02 * s;
        out[7] = a13 * c - a03 * s;
        out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
        out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
        return out;
    },
    
    perspective: (out, fovy, aspect, near, far) => {
        const f = 1.0 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        
        out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
        out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
        out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
        out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
        return out;
    },
    
    lookAt: (out, eye, center, up) => {
        const z = vec3.normalize(vec3.subtract(eye, center));
        const x = vec3.normalize(vec3.cross(up, z));
        const y = vec3.cross(z, x);
        
        out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
        out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
        out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
        out[12] = -vec3.dot(x, eye);
        out[13] = -vec3.dot(y, eye);
        out[14] = -vec3.dot(z, eye);
        out[15] = 1;
        return out;
    },
    
    invert: (out, a) => {
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
        
        const b00 = a00 * a11 - a01 * a10;
        const b01 = a00 * a12 - a02 * a10;
        const b02 = a00 * a13 - a03 * a10;
        const b03 = a01 * a12 - a02 * a11;
        const b04 = a01 * a13 - a03 * a11;
        const b05 = a02 * a13 - a03 * a12;
        const b06 = a20 * a31 - a21 * a30;
        const b07 = a20 * a32 - a22 * a30;
        const b08 = a20 * a33 - a23 * a30;
        const b09 = a21 * a32 - a22 * a31;
        const b10 = a21 * a33 - a23 * a31;
        const b11 = a22 * a33 - a23 * a32;
        
        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
        
        if (!det) return null;
        det = 1.0 / det;
        
        out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
        out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
        out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
        out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
        out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
        out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
        out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
        out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
        out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
        out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
        out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
        out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
        out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
        out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
        out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
        out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
        
        return out;
    }
};

// ============================================================================
// Matrix Stack
// ============================================================================

function pushMatrix() {
    const currentMatrix = state.matrixStack.length > 0 
        ? state.matrixStack[state.matrixStack.length - 1] 
        : mat4.create();
    state.matrixStack.push(mat4.clone(currentMatrix));
}

function popMatrix() {
    if (state.matrixStack.length > 0) {
        state.matrixStack.pop();
    }
}

function getCurrentMatrix() {
    return state.matrixStack.length > 0 
        ? state.matrixStack[state.matrixStack.length - 1] 
        : mat4.create();
}

function applyTransform(translation, rotation) {
    let matrix = getCurrentMatrix();
    
    // Apply translation
    matrix = mat4.translate(mat4.create(), matrix, translation);
    
    // Apply rotations (in XYZ order)
    matrix = mat4.rotateX(mat4.create(), matrix, rotation[0]);
    matrix = mat4.rotateY(mat4.create(), matrix, rotation[1]);
    matrix = mat4.rotateZ(mat4.create(), matrix, rotation[2]);
    
    state.matrixStack[state.matrixStack.length - 1] = matrix;
}

// ============================================================================
// WebGL Initialization
// ============================================================================

function initWebGL() {
    state.canvas = document.getElementById('webgl-canvas');
    state.gl = state.canvas.getContext('webgl') || state.canvas.getContext('experimental-webgl');
    
    if (!state.gl) {
        alert('WebGL not supported in your browser!');
        return false;
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Enable depth testing and backface culling
    state.gl.enable(state.gl.DEPTH_TEST);
    state.gl.enable(state.gl.CULL_FACE);
    state.gl.cullFace(state.gl.BACK);
    
    return true;
}

function resizeCanvas() {
    const container = state.canvas.parentElement;
    state.canvas.width = container.clientWidth;
    state.canvas.height = container.clientHeight;
    state.gl.viewport(0, 0, state.canvas.width, state.canvas.height);
}

// ============================================================================
// Shader Creation
// ============================================================================

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    
    return program;
}

function initShaders() {
    const vertexShaderSource = `
        attribute vec3 aPosition;
        attribute vec3 aNormal;
        attribute vec2 aTexCoord;
        
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        uniform mat4 uNormalMatrix;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vTexCoord;
        
        void main() {
            vec4 worldPosition = uModelViewMatrix * vec4(aPosition, 1.0);
            vPosition = worldPosition.xyz;
            vNormal = normalize((uNormalMatrix * vec4(aNormal, 0.0)).xyz);
            vTexCoord = aTexCoord;
            gl_Position = uProjectionMatrix * worldPosition;
        }
    `;
    
    const fragmentShaderSource = `
        precision mediump float;
        
        uniform vec3 uLightDirection;
        uniform vec3 uCameraPosition;
        uniform sampler2D uTexture;
        uniform bool uHasTexture;
        uniform vec3 uTintColor;
        uniform bool uUseTint;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vTexCoord;
        
        void main() {
            vec3 normal = normalize(vNormal);
            vec3 lightDir = normalize(-uLightDirection);
            
            // Diffuse lighting
            float diff = max(dot(normal, lightDir), 0.0);
            vec3 diffuse = vec3(diff);
            
            // Specular lighting
            vec3 viewDir = normalize(uCameraPosition - vPosition);
            vec3 reflectDir = reflect(-lightDir, normal);
            float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
            vec3 specular = vec3(spec * 0.5);
            
            // Ambient lighting
            vec3 ambient = vec3(0.3);
            
            // Combine lighting
            vec3 lighting = ambient + diffuse + specular;
            
            // Get base color
            vec3 baseColor;
            if (uHasTexture) {
                baseColor = texture2D(uTexture, vTexCoord).rgb;
            } else {
                baseColor = vec3(0.7);
            }
            
            // Apply tint if needed
            if (uUseTint) {
                baseColor = mix(baseColor, uTintColor, 0.5);
            }
            
            gl_FragColor = vec4(baseColor * lighting, 1.0);
        }
    `;
    
    // Picking shader
    const pickingVertexShaderSource = `
        attribute vec3 aPosition;
        
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        
        void main() {
            gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
        }
    `;
    
    const pickingFragmentShaderSource = `
        precision mediump float;
        
        uniform vec4 uPickingColor;
        
        void main() {
            gl_FragColor = uPickingColor;
        }
    `;
    
    const vertexShader = createShader(state.gl, state.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(state.gl, state.gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
        return false;
    }
    
    state.shaderProgram = createProgram(state.gl, vertexShader, fragmentShader);
    
    if (!state.shaderProgram) {
        return false;
    }
    
    // Get attribute and uniform locations
    state.shaderProgram.aPosition = state.gl.getAttribLocation(state.shaderProgram, 'aPosition');
    state.shaderProgram.aNormal = state.gl.getAttribLocation(state.shaderProgram, 'aNormal');
    state.shaderProgram.aTexCoord = state.gl.getAttribLocation(state.shaderProgram, 'aTexCoord');
    
    state.shaderProgram.uModelViewMatrix = state.gl.getUniformLocation(state.shaderProgram, 'uModelViewMatrix');
    state.shaderProgram.uProjectionMatrix = state.gl.getUniformLocation(state.shaderProgram, 'uProjectionMatrix');
    state.shaderProgram.uNormalMatrix = state.gl.getUniformLocation(state.shaderProgram, 'uNormalMatrix');
    state.shaderProgram.uLightDirection = state.gl.getUniformLocation(state.shaderProgram, 'uLightDirection');
    state.shaderProgram.uCameraPosition = state.gl.getUniformLocation(state.shaderProgram, 'uCameraPosition');
    state.shaderProgram.uTexture = state.gl.getUniformLocation(state.shaderProgram, 'uTexture');
    state.shaderProgram.uHasTexture = state.gl.getUniformLocation(state.shaderProgram, 'uHasTexture');
    state.shaderProgram.uTintColor = state.gl.getUniformLocation(state.shaderProgram, 'uTintColor');
    state.shaderProgram.uUseTint = state.gl.getUniformLocation(state.shaderProgram, 'uUseTint');
    
    // Create picking shader
    const pickingVertexShader = createShader(state.gl, state.gl.VERTEX_SHADER, pickingVertexShaderSource);
    const pickingFragmentShader = createShader(state.gl, state.gl.FRAGMENT_SHADER, pickingFragmentShaderSource);
    
    if (!pickingVertexShader || !pickingFragmentShader) {
        return false;
    }
    
    state.pickingShaderProgram = createProgram(state.gl, pickingVertexShader, pickingFragmentShader);
    
    if (!state.pickingShaderProgram) {
        return false;
    }
    
    state.pickingShaderProgram.aPosition = state.gl.getAttribLocation(state.pickingShaderProgram, 'aPosition');
    state.pickingShaderProgram.uModelViewMatrix = state.gl.getUniformLocation(state.pickingShaderProgram, 'uModelViewMatrix');
    state.pickingShaderProgram.uProjectionMatrix = state.gl.getUniformLocation(state.pickingShaderProgram, 'uProjectionMatrix');
    state.pickingShaderProgram.uPickingColor = state.gl.getUniformLocation(state.pickingShaderProgram, 'uPickingColor');
    
    return true;
}

// ============================================================================
// OBJ and MTL Loading
// ============================================================================

async function loadTextFile(url) {
    const response = await fetch(url);
    return await response.text();
}

async function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Placeholder pixel while loading
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
    
    const image = new Image();
    image.crossOrigin = 'anonymous';
    
    return new Promise((resolve) => {
        image.onload = () => {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            resolve(texture);
        };
        
        image.onerror = () => {
            console.warn('Failed to load texture:', url);
            resolve(texture); // Return placeholder texture
        };
        
        image.src = url;
    });
}

async function parseMTL(mtlText, basePath) {
    const materials = {};
    let currentMaterial = null;
    
    const lines = mtlText.split('\n');
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        
        const parts = line.split(/\s+/);
        const command = parts[0];
        
        if (command === 'newmtl') {
            currentMaterial = parts[1];
            materials[currentMaterial] = {
                name: currentMaterial,
                texture: null
            };
        } else if (command === 'map_Kd' && currentMaterial) {
            const texturePath = parts.slice(1).join(' ');
            const textureUrl = basePath + '/' + texturePath;
            materials[currentMaterial].texturePath = textureUrl;
        }
    }
    
    // Load all textures
    for (let matName in materials) {
        if (materials[matName].texturePath) {
            materials[matName].texture = await loadTexture(state.gl, materials[matName].texturePath);
        }
    }
    
    return materials;
}

async function parseOBJ(objText, materials) {
    const positions = [];
    const normals = [];
    const texCoords = [];
    const vertices = [];
    const indices = [];
    
    let currentMaterial = null;
    
    const lines = objText.split('\n');
    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        
        const parts = line.split(/\s+/);
        const command = parts[0];
        
        if (command === 'v') {
            positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        } else if (command === 'vn') {
            normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        } else if (command === 'vt') {
            texCoords.push([parseFloat(parts[1]), parseFloat(parts[2])]);
        } else if (command === 'usemtl') {
            currentMaterial = parts[1];
        } else if (command === 'f') {
            // Parse face - supports format v/vt/vn
            const faceVertices = [];
            for (let i = 1; i < parts.length; i++) {
                const vertexData = parts[i].split('/');
                const posIdx = parseInt(vertexData[0]) - 1;
                const texIdx = vertexData[1] ? parseInt(vertexData[1]) - 1 : 0;
                const normIdx = vertexData[2] ? parseInt(vertexData[2]) - 1 : 0;
                
                const pos = positions[posIdx] || [0, 0, 0];
                const tex = texCoords[texIdx] || [0, 0];
                const norm = normals[normIdx] || [0, 1, 0];
                
                faceVertices.push({
                    position: pos,
                    normal: norm,
                    texCoord: tex
                });
            }
            
            // Triangulate if necessary (assume convex polygons)
            for (let i = 1; i < faceVertices.length - 1; i++) {
                indices.push(vertices.length);
                vertices.push(faceVertices[0]);
                
                indices.push(vertices.length);
                vertices.push(faceVertices[i]);
                
                indices.push(vertices.length);
                vertices.push(faceVertices[i + 1]);
            }
        }
    }
    
    // Create flat arrays for WebGL
    const positionArray = [];
    const normalArray = [];
    const texCoordArray = [];
    
    for (let v of vertices) {
        positionArray.push(...v.position);
        normalArray.push(...v.normal);
        texCoordArray.push(...v.texCoord);
    }
    
    return {
        positions: new Float32Array(positionArray),
        normals: new Float32Array(normalArray),
        texCoords: new Float32Array(texCoordArray),
        indices: new Uint16Array(indices),
        material: currentMaterial,
        materials: materials
    };
}

async function loadModel(name, objPath, mtlPath) {
    const basePath = objPath.substring(0, objPath.lastIndexOf('/'));
    
    const [objText, mtlText] = await Promise.all([
        loadTextFile(objPath),
        loadTextFile(mtlPath)
    ]);
    
    const materials = await parseMTL(mtlText, basePath);
    const modelData = await parseOBJ(objText, materials);
    
    // Create WebGL buffers
    const gl = state.gl;
    
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.positions, gl.STATIC_DRAW);
    
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.normals, gl.STATIC_DRAW);
    
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.texCoords, gl.STATIC_DRAW);
    
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, modelData.indices, gl.STATIC_DRAW);
    
    state.models[name] = {
        positionBuffer,
        normalBuffer,
        texCoordBuffer,
        indexBuffer,
        indexCount: modelData.indices.length,
        materials: modelData.materials,
        material: modelData.material
    };
    
    console.log(`Loaded model: ${name} (${modelData.indices.length / 3} triangles)`);
}

async function loadAllModels() {
    await Promise.all([
        loadModel('body', 'assets/body.obj', 'assets/body.mtl'),
        loadModel('head', 'assets/head.obj', 'assets/head.mtl'),
        loadModel('upper_leg', 'assets/upper_leg.obj', 'assets/upper_leg.mtl'),
        loadModel('lower_leg', 'assets/lower_leg.obj', 'assets/lower_leg.mtl')
    ]);
}

// ============================================================================
// Rendering
// ============================================================================

function drawModel(modelName, useTint = false) {
    const model = state.models[modelName];
    if (!model) return;
    
    const gl = state.gl;
    const program = state.shaderProgram;
    
    // Bind buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, model.positionBuffer);
    gl.vertexAttribPointer(program.aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.aPosition);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
    gl.vertexAttribPointer(program.aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.aNormal);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, model.texCoordBuffer);
    gl.vertexAttribPointer(program.aTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.aTexCoord);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
    
    // Set matrices
    const modelViewMatrix = getCurrentMatrix();
    gl.uniformMatrix4fv(program.uModelViewMatrix, false, modelViewMatrix);
    
    // Normal matrix (inverse transpose of model-view)
    const normalMatrix = mat4.create();
    mat4.invert(normalMatrix, modelViewMatrix);
    gl.uniformMatrix4fv(program.uNormalMatrix, false, normalMatrix);
    
    // Set texture
    let hasTexture = false;
    if (model.material && model.materials[model.material] && model.materials[model.material].texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, model.materials[model.material].texture);
        gl.uniform1i(program.uTexture, 0);
        hasTexture = true;
    }
    gl.uniform1i(program.uHasTexture, hasTexture);
    
    // Set tint
    gl.uniform1i(program.uUseTint, useTint);
    if (useTint) {
        gl.uniform3f(program.uTintColor, 1.0, 0.0, 0.0); // Red tint
    }
    
    // Draw
    gl.drawElements(gl.TRIANGLES, model.indexCount, gl.UNSIGNED_SHORT, 0);
}

function createGridBuffers() {
    const gl = state.gl;
    const gridSize = 20;
    const gridStep = 1;
    const positions = [];
    const colors = [];
    
    // Create grid lines
    for (let i = -gridSize; i <= gridSize; i++) {
        const t = Math.abs(i) / gridSize;
        const alpha = 1.0 - t * 0.8; // Fade towards edges
        
        // Lines parallel to X axis
        positions.push(-gridSize * gridStep, 0, i * gridStep);
        positions.push(gridSize * gridStep, 0, i * gridStep);
        colors.push(0.3, 0.3, 0.3, alpha);
        colors.push(0.3, 0.3, 0.3, alpha);
        
        // Lines parallel to Z axis
        positions.push(i * gridStep, 0, -gridSize * gridStep);
        positions.push(i * gridStep, 0, gridSize * gridStep);
        colors.push(0.3, 0.3, 0.3, alpha);
        colors.push(0.3, 0.3, 0.3, alpha);
    }
    
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    
    state.gridBuffers = {
        position: positionBuffer,
        color: colorBuffer,
        vertexCount: positions.length / 3
    };
}

function drawGroundGrid() {
    if (!state.gridBuffers) return;
    
    const gl = state.gl;
    
    // For simplicity, we'll draw the grid with a simple shader approach
    // We'll use the existing shader but with no texture and flat shading
    const gridPositions = [];
    const gridSize = 20;
    const gridStep = 1;
    
    // Since our shader expects a full model, we'll skip the grid for now
    // to avoid complexity. The ground plane color should be sufficient.
}

function getCameraPosition() {
    const x = state.camera.target[0] + state.camera.distance * Math.sin(state.camera.theta) * Math.cos(state.camera.phi);
    const y = state.camera.target[1] + state.camera.distance * Math.sin(state.camera.phi);
    const z = state.camera.target[2] + state.camera.distance * Math.cos(state.camera.theta) * Math.cos(state.camera.phi);
    return [x, y, z];
}

// ============================================================================
// Hierarchical Robot Rendering
// ============================================================================

function getTransformForPart(partName, time) {
    const keyframes = state.animation.keyframes[partName] || [];
    
    if (keyframes.length === 0) {
        // Return default transform
        return {
            translation: vec3.clone(DEFAULT_TRANSFORMS[partName].translation),
            rotation: vec3.clone(DEFAULT_TRANSFORMS[partName].rotation)
        };
    }
    
    // Sort keyframes by time
    keyframes.sort((a, b) => a.time - b.time);
    
    // Find surrounding keyframes
    let kf1 = keyframes[keyframes.length - 1];
    let kf2 = keyframes[0];
    
    for (let i = 0; i < keyframes.length; i++) {
        if (keyframes[i].time <= time) {
            kf1 = keyframes[i];
        }
        if (keyframes[i].time > time) {
            kf2 = keyframes[i];
            break;
        }
    }
    
    // Handle wrapping for looping
    if (kf1.time > kf2.time) {
        // Wrap around
        const totalDuration = 1.0;
        let t;
        if (time >= kf1.time) {
            t = (time - kf1.time) / (totalDuration - kf1.time + kf2.time);
        } else {
            t = (time + totalDuration - kf1.time) / (totalDuration - kf1.time + kf2.time);
        }
        t = Math.max(0, Math.min(1, t));
        
        return {
            translation: [
                kf1.translation[0] + (kf2.translation[0] - kf1.translation[0]) * t,
                kf1.translation[1] + (kf2.translation[1] - kf1.translation[1]) * t,
                kf1.translation[2] + (kf2.translation[2] - kf1.translation[2]) * t
            ],
            rotation: [
                kf1.rotation[0] + (kf2.rotation[0] - kf1.rotation[0]) * t,
                kf1.rotation[1] + (kf2.rotation[1] - kf1.rotation[1]) * t,
                kf1.rotation[2] + (kf2.rotation[2] - kf1.rotation[2]) * t
            ]
        };
    }
    
    // Linear interpolation
    if (kf1.time === kf2.time) {
        return {
            translation: vec3.clone(kf1.translation),
            rotation: vec3.clone(kf1.rotation)
        };
    }
    
    const t = (time - kf1.time) / (kf2.time - kf1.time);
    
    return {
        translation: [
            kf1.translation[0] + (kf2.translation[0] - kf1.translation[0]) * t,
            kf1.translation[1] + (kf2.translation[1] - kf1.translation[1]) * t,
            kf1.translation[2] + (kf2.translation[2] - kf1.translation[2]) * t
        ],
        rotation: [
            kf1.rotation[0] + (kf2.rotation[0] - kf1.rotation[0]) * t,
            kf1.rotation[1] + (kf2.rotation[1] - kf1.rotation[1]) * t,
            kf1.rotation[2] + (kf2.rotation[2] - kf1.rotation[2]) * t
        ]
    };
}

function drawBody(time) {
    const transform = getTransformForPart('Body', time);
    const isSelected = state.selectedKeyframe && state.selectedKeyframe.partName === 'Body';
    
    pushMatrix();
    applyTransform(transform.translation, transform.rotation);
    drawModel('body', isSelected);
    
    // Draw children
    drawHead(time);
    drawUpperLeg('FL', time);
    drawUpperLeg('FR', time);
    drawUpperLeg('BL', time);
    drawUpperLeg('BR', time);
    
    popMatrix();
}

function drawHead(time) {
    const transform = getTransformForPart('Head', time);
    const isSelected = state.selectedKeyframe && state.selectedKeyframe.partName === 'Head';
    
    pushMatrix();
    applyTransform(transform.translation, transform.rotation);
    drawModel('head', isSelected);
    popMatrix();
}

function drawUpperLeg(legId, time) {
    const upperName = 'UpperLeg' + legId;
    const lowerName = 'LowerLeg' + legId;
    
    const transform = getTransformForPart(upperName, time);
    const isSelected = state.selectedKeyframe && state.selectedKeyframe.partName === upperName;
    
    pushMatrix();
    applyTransform(transform.translation, transform.rotation);
    drawModel('upper_leg', isSelected);
    
    // Draw lower leg
    drawLowerLeg(legId, time);
    
    popMatrix();
}

function drawLowerLeg(legId, time) {
    const lowerName = 'LowerLeg' + legId;
    const transform = getTransformForPart(lowerName, time);
    const isSelected = state.selectedKeyframe && state.selectedKeyframe.partName === lowerName;
    
    pushMatrix();
    applyTransform(transform.translation, transform.rotation);
    drawModel('lower_leg', isSelected);
    popMatrix();
}

function render() {
    const gl = state.gl;
    
    // Clear with a nice gradient-like background
    gl.clearColor(0.65, 0.65, 0.70, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Use shader program
    gl.useProgram(state.shaderProgram);
    
    // Set up projection matrix
    const projectionMatrix = mat4.create();
    const aspect = state.canvas.width / state.canvas.height;
    mat4.perspective(projectionMatrix, Math.PI / 4, aspect, 0.1, 1000.0);
    gl.uniformMatrix4fv(state.shaderProgram.uProjectionMatrix, false, projectionMatrix);
    
    // Set up view matrix
    const cameraPos = getCameraPosition();
    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, cameraPos, state.camera.target, [0, 1, 0]);
    
    // Set lighting
    gl.uniform3f(state.shaderProgram.uLightDirection, 0.5, -1.0, 0.5);
    gl.uniform3f(state.shaderProgram.uCameraPosition, cameraPos[0], cameraPos[1], cameraPos[2]);
    
    // Initialize matrix stack with view matrix
    state.matrixStack = [viewMatrix];
    
    // Draw robot hierarchy
    const currentTime = state.animation.currentTime;
    drawBody(currentTime);
    
    // Draw ground grid
    drawGroundGrid();
    
    // Draw gizmo if visible
    if (state.gizmo.visible) {
        drawGizmo(projectionMatrix, viewMatrix);
    }
}

// ============================================================================
// Animation System
// ============================================================================

function updateAnimation(deltaTime) {
    if (!state.animation.isPlaying) return;
    
    // Update current time (as percentage 0-1)
    const percentPerSecond = 1.0 / state.animation.duration;
    state.animation.currentTime += percentPerSecond * deltaTime;
    
    // Loop
    if (state.animation.currentTime >= 1.0) {
        state.animation.currentTime = state.animation.currentTime % 1.0;
    }
    
    updatePlayheadPosition();
}

function updatePlayheadPosition() {
    const playhead = document.getElementById('playhead');
    const percent = state.animation.currentTime * 100;
    playhead.style.left = percent + '%';
}

// ============================================================================
// UI - Timeline Editor
// ============================================================================

function initTimeline() {
    const tracksContainer = document.getElementById('tracks-container');
    tracksContainer.innerHTML = '';
    
    PARTS.forEach(partName => {
        const row = document.createElement('div');
        row.className = 'track-row';
        row.dataset.part = partName;
        
        const label = document.createElement('div');
        label.className = 'track-label';
        label.textContent = formatPartName(partName);
        
        const content = document.createElement('div');
        content.className = 'track-content';
        content.dataset.part = partName;
        
        row.appendChild(label);
        row.appendChild(content);
        tracksContainer.appendChild(row);
        
        // Click to add keyframe
        content.addEventListener('click', (e) => {
            if (state.animation.isPlaying) return;
            
            const rect = content.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = x / rect.width;
            const time = Math.max(0, Math.min(1, percent));
            
            addKeyframe(partName, time);
        });
    });
    
    // Timeline ruler
    const ruler = document.getElementById('timeline-ruler');
    ruler.innerHTML = '<div id="playhead"></div>';
    
    for (let i = 0; i <= 10; i++) {
        const tick = document.createElement('div');
        tick.className = 'ruler-tick';
        tick.style.left = (i * 10) + '%';
        ruler.appendChild(tick);
        
        const label = document.createElement('div');
        label.className = 'ruler-label';
        label.textContent = (i * 10);
        label.style.left = (i * 10) + '%';
        ruler.appendChild(label);
    }
    
    // Click ruler to seek
    ruler.addEventListener('click', (e) => {
        if (state.animation.isPlaying) return;
        
        const rect = ruler.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / rect.width;
        state.animation.currentTime = Math.max(0, Math.min(1, percent));
        updatePlayheadPosition();
        render();
    });
}

function formatPartName(partName) {
    // Convert camelCase to readable name
    const formatted = partName.replace(/([A-Z])/g, ' $1').trim();
    return formatted;
}

function addKeyframe(partName, time) {
    if (!state.animation.keyframes[partName]) {
        state.animation.keyframes[partName] = [];
    }
    
    // Get current transform at this time
    const transform = getTransformForPart(partName, time);
    
    // Check if keyframe already exists at this time
    const existingIndex = state.animation.keyframes[partName].findIndex(kf => 
        Math.abs(kf.time - time) < 0.01
    );
    
    if (existingIndex >= 0) {
        // Select existing keyframe
        selectKeyframe(partName, existingIndex);
    } else {
        // Add new keyframe
        state.animation.keyframes[partName].push({
            time: time,
            translation: transform.translation,
            rotation: transform.rotation,
            initialTranslation: vec3.clone(transform.translation),
            initialRotation: vec3.clone(transform.rotation)
        });
        
        // Sort keyframes
        state.animation.keyframes[partName].sort((a, b) => a.time - b.time);
        
        // Select new keyframe
        const newIndex = state.animation.keyframes[partName].findIndex(kf => 
            Math.abs(kf.time - time) < 0.01
        );
        selectKeyframe(partName, newIndex);
    }
    
    updateTimelineDisplay();
}

function selectKeyframe(partName, keyframeIndex) {
    const keyframes = state.animation.keyframes[partName];
    if (!keyframes || keyframeIndex < 0 || keyframeIndex >= keyframes.length) return;
    
    state.selectedKeyframe = {
        partName: partName,
        keyframeIndex: keyframeIndex
    };
    
    const keyframe = keyframes[keyframeIndex];
    state.animation.currentTime = keyframe.time;
    
    // Show gizmo at the part's world position
    updateGizmoPosition();
    state.gizmo.visible = true;
    
    updateTimelineDisplay();
    updateControlsPanel();
    updatePlayheadPosition();
    render();
}

function deleteSelectedKeyframe() {
    if (!state.selectedKeyframe) return;
    
    const { partName, keyframeIndex } = state.selectedKeyframe;
    const keyframes = state.animation.keyframes[partName];
    
    if (keyframes && keyframeIndex >= 0 && keyframeIndex < keyframes.length) {
        keyframes.splice(keyframeIndex, 1);
        state.selectedKeyframe = null;
        state.gizmo.visible = false;
        updateTimelineDisplay();
        updateControlsPanel();
        render();
    }
}

function updateTimelineDisplay() {
    console.log('🔄 Updating timeline display...');
    console.log('Current keyframes in state:', state.animation.keyframes);
    
    let totalKeyframesDisplayed = 0;
    
    PARTS.forEach(partName => {
        const content = document.querySelector(`.track-content[data-part="${partName}"]`);
        if (!content) {
            console.warn(`⚠️ No track content found for: ${partName}`);
            return;
        }
        
        // Clear existing keyframes
        content.querySelectorAll('.keyframe').forEach(el => el.remove());
        
        // Add keyframes
        const keyframes = state.animation.keyframes[partName] || [];
        console.log(`📍 ${partName}: ${keyframes.length} keyframes`);
        
        keyframes.forEach((kf, index) => {
            const keyframeEl = document.createElement('div');
            keyframeEl.className = 'keyframe';
            keyframeEl.style.left = (kf.time * 100) + '%';
            keyframeEl.dataset.part = partName;
            keyframeEl.dataset.index = index;
            
            console.log(`  - Keyframe ${index} at time ${kf.time} (${(kf.time * 100).toFixed(1)}%)`);
            
            if (state.selectedKeyframe && 
                state.selectedKeyframe.partName === partName && 
                state.selectedKeyframe.keyframeIndex === index) {
                keyframeEl.classList.add('selected');
            }
            
            keyframeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!state.animation.isPlaying) {
                    selectKeyframe(partName, index);
                }
            });
            
            content.appendChild(keyframeEl);
            totalKeyframesDisplayed++;
        });
    });
    
    console.log(`✅ Timeline updated. Total keyframes displayed: ${totalKeyframesDisplayed}`);
}

function updateControlsPanel() {
    const controlsContent = document.getElementById('controls-content');
    
    if (!state.selectedKeyframe) {
        controlsContent.innerHTML = '<div class="no-selection">Select a keyframe to edit its values</div>';
        return;
    }
    
    const { partName, keyframeIndex } = state.selectedKeyframe;
    const keyframes = state.animation.keyframes[partName];
    if (!keyframes || keyframeIndex < 0 || keyframeIndex >= keyframes.length) return;
    
    const keyframe = keyframes[keyframeIndex];
    const gizmoModeIcon = state.gizmo.mode === 'translate' ? '↔️' : '🔄';
    const gizmoModeName = state.gizmo.mode === 'translate' ? 'Translate' : 'Rotate';
    
    controlsContent.innerHTML = `
        <h3>Controls: ${formatPartName(partName)}</h3>
        <div style="background: #333; padding: 8px; border-radius: 4px; margin-bottom: 15px; text-align: center;">
            <strong style="color: #ff9800;">Gizmo Mode: ${gizmoModeIcon} ${gizmoModeName}</strong>
            <br>
            <small style="color: #aaa;">Press G to toggle • T for translate • R for rotate</small>
        </div>
        
        <div class="control-group">
            <div class="control-label">Translation</div>
            ${createSlider('translation', 'x', keyframe.translation[0], -5, 5)}
            ${createSlider('translation', 'y', keyframe.translation[1], -5, 5)}
            ${createSlider('translation', 'z', keyframe.translation[2], -5, 5)}
            <button class="reset-btn" onclick="resetTransform('translation')">Reset Translation</button>
        </div>
        
        <div class="control-group">
            <div class="control-label">Rotation (radians)</div>
            ${createSlider('rotation', 'x', keyframe.rotation[0], -Math.PI, Math.PI)}
            ${createSlider('rotation', 'y', keyframe.rotation[1], -Math.PI, Math.PI)}
            ${createSlider('rotation', 'z', keyframe.rotation[2], -Math.PI, Math.PI)}
            <button class="reset-btn" onclick="resetTransform('rotation')">Reset Rotation</button>
        </div>
    `;
    
    // Add event listeners to sliders
    controlsContent.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const type = e.target.dataset.type;
            const axis = e.target.dataset.axis;
            const value = parseFloat(e.target.value);
            updateKeyframeValue(type, axis, value);
        });
    });
}

function createSlider(type, axis, value, min, max) {
    const step = (max - min) / 200;
    return `
        <div class="slider-container">
            <label>${axis.toUpperCase()}</label>
            <input type="range" 
                   min="${min}" 
                   max="${max}" 
                   step="${step}" 
                   value="${value}"
                   data-type="${type}"
                   data-axis="${axis}">
            <span class="value-display">${value.toFixed(2)}</span>
        </div>
    `;
}

function updateKeyframeValue(type, axis, value) {
    if (!state.selectedKeyframe) return;
    
    const { partName, keyframeIndex } = state.selectedKeyframe;
    const keyframes = state.animation.keyframes[partName];
    if (!keyframes || keyframeIndex < 0 || keyframeIndex >= keyframes.length) return;
    
    const keyframe = keyframes[keyframeIndex];
    const axisIndex = { x: 0, y: 1, z: 2 }[axis];
    
    if (type === 'translation') {
        keyframe.translation[axisIndex] = value;
    } else if (type === 'rotation') {
        keyframe.rotation[axisIndex] = value;
    }
    
    // Update display
    const valueDisplay = document.querySelector(`input[data-type="${type}"][data-axis="${axis}"]`)
        ?.parentElement.querySelector('.value-display');
    if (valueDisplay) {
        valueDisplay.textContent = value.toFixed(2);
    }
    
    render();
}

function resetTransform(type) {
    if (!state.selectedKeyframe) return;
    
    const { partName, keyframeIndex } = state.selectedKeyframe;
    const keyframes = state.animation.keyframes[partName];
    if (!keyframes || keyframeIndex < 0 || keyframeIndex >= keyframes.length) return;
    
    const keyframe = keyframes[keyframeIndex];
    
    if (type === 'translation') {
        keyframe.translation = vec3.clone(keyframe.initialTranslation);
    } else if (type === 'rotation') {
        keyframe.rotation = vec3.clone(keyframe.initialRotation);
    }
    
    updateControlsPanel();
    render();
}

// ============================================================================
// UI - Controls
// ============================================================================

function initControls() {
    // Play button
    document.getElementById('play-btn').addEventListener('click', () => {
        state.animation.isPlaying = true;
    });
    
    // Pause button
    document.getElementById('pause-btn').addEventListener('click', () => {
        state.animation.isPlaying = false;
    });
    
    // Reset button
    document.getElementById('reset-btn').addEventListener('click', () => {
        state.animation.isPlaying = false;
        state.animation.currentTime = 0;
        updatePlayheadPosition();
        render();
    });
    
    // Duration input
    document.getElementById('duration-input').addEventListener('input', (e) => {
        const newDuration = parseFloat(e.target.value);
        if (newDuration > 0) {
            state.animation.duration = newDuration;
        }
    });
    
    // Save button
    document.getElementById('save-btn').addEventListener('click', saveKeyframes);
    
    // Load button
    document.getElementById('load-btn').addEventListener('click', () => {
        console.log('Load button clicked');
        loadKeyframes();
    });
    
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        // Handle both Delete and Backspace keys
        if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedKeyframe && !state.animation.isPlaying) {
            e.preventDefault();
            deleteSelectedKeyframe();
        }
        
        // Toggle gizmo mode with G key
        if (e.key === 'g' || e.key === 'G') {
            if (state.gizmo.visible) {
                state.gizmo.mode = state.gizmo.mode === 'translate' ? 'rotate' : 'translate';
                console.log('Gizmo mode:', state.gizmo.mode);
                render();
            }
        }
        
        // R for rotate mode
        if (e.key === 'r' || e.key === 'R') {
            if (state.gizmo.visible) {
                state.gizmo.mode = 'rotate';
                console.log('Gizmo mode: rotate');
                render();
            }
        }
        
        // T for translate mode
        if (e.key === 't' || e.key === 'T') {
            if (state.gizmo.visible) {
                state.gizmo.mode = 'translate';
                console.log('Gizmo mode: translate');
                render();
            }
        }
    });
}

// ============================================================================
// Camera Controls
// ============================================================================

function initCameraControls() {
    state.canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            // Check if clicking on gizmo first
            if (state.gizmo.visible) {
                handleGizmoPicking(e);
                if (state.gizmo.isDragging) {
                    state.camera.hasMoved = false;
                    e.preventDefault();
                    return;
                }
            }
            
            // Otherwise handle camera controls
            if (e.shiftKey || e.ctrlKey || state.camera.isPanning) {
                state.camera.isPanning = true;
            } else {
                state.camera.isDragging = true;
            }
            state.camera.lastX = e.clientX;
            state.camera.lastY = e.clientY;
            state.camera.hasMoved = false;
            e.preventDefault();
        }
    });
    
    // Add click handler for picking
    state.canvas.addEventListener('click', (e) => {
        if (!state.animation.isPlaying && !state.camera.hasMoved) {
            // Check if shift key is pressed to toggle gizmo mode
            if (e.shiftKey && state.gizmo.visible) {
                state.gizmo.mode = state.gizmo.mode === 'translate' ? 'rotate' : 'translate';
                render();
            } else {
                handlePicking(e);
            }
        }
    });
    
    state.canvas.addEventListener('mousemove', (e) => {
        if (state.gizmo.isDragging && state.gizmo.selectedAxis) {
            // Handle gizmo dragging
            const deltaX = e.clientX - state.gizmo.dragStart.x;
            const deltaY = e.clientY - state.gizmo.dragStart.y;
            handleGizmoDrag(deltaX, deltaY);
            state.gizmo.dragStart.x = e.clientX;
            state.gizmo.dragStart.y = e.clientY;
            state.camera.hasMoved = true;
        } else if (state.camera.isDragging) {
            const deltaX = e.clientX - state.camera.lastX;
            const deltaY = e.clientY - state.camera.lastY;
            
            state.camera.hasMoved = true;
            state.camera.theta += deltaX * 0.01;
            state.camera.phi += deltaY * 0.01;
            
            // Clamp phi to avoid gimbal lock
            state.camera.phi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, state.camera.phi));
            
            state.camera.lastX = e.clientX;
            state.camera.lastY = e.clientY;
            
            render();
        } else if (state.camera.isPanning) {
            const deltaX = e.clientX - state.camera.lastX;
            const deltaY = e.clientY - state.camera.lastY;
            
            state.camera.hasMoved = true;
            const right = vec3.normalize(vec3.cross([0, 1, 0], vec3.subtract(getCameraPosition(), state.camera.target)));
            const up = [0, 1, 0];
            
            const panSpeed = 0.01;
            state.camera.target[0] -= right[0] * deltaX * panSpeed;
            state.camera.target[1] += up[1] * deltaY * panSpeed;
            state.camera.target[2] -= right[2] * deltaX * panSpeed;
            
            state.camera.lastX = e.clientX;
            state.camera.lastY = e.clientY;
            
            render();
        }
    });
    
    state.canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            state.camera.isDragging = false;
            state.camera.isPanning = false;
            state.gizmo.isDragging = false;
            state.gizmo.selectedAxis = null;
        }
    });
    
    state.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1.1 : 0.9;
        state.camera.distance *= delta;
        state.camera.distance = Math.max(2, Math.min(50, state.camera.distance));
        render();
    });
    
    // Space bar for panning
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !state.camera.isDragging) {
            state.camera.isPanning = true;
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            state.camera.isPanning = false;
        }
    });
}

// ============================================================================
// Picking System
// ============================================================================

// Part ID to color mapping for picking
const PART_COLORS = {
    'Body': [1, 0, 0, 1],
    'Head': [2, 0, 0, 1],
    'UpperLegFL': [3, 0, 0, 1],
    'LowerLegFL': [4, 0, 0, 1],
    'UpperLegFR': [5, 0, 0, 1],
    'LowerLegFR': [6, 0, 0, 1],
    'UpperLegBL': [7, 0, 0, 1],
    'LowerLegBL': [8, 0, 0, 1],
    'UpperLegBR': [9, 0, 0, 1],
    'LowerLegBR': [10, 0, 0, 1]
};

// Gizmo picking colors
const GIZMO_COLORS = {
    'x': [100, 0, 0, 1],
    'y': [0, 100, 0, 1],
    'z': [0, 0, 100, 1],
    'rx': [150, 0, 0, 1],
    'ry': [0, 150, 0, 1],
    'rz': [0, 0, 150, 1]
};

function initPickingFramebuffer() {
    const gl = state.gl;
    
    // Create framebuffer
    state.pickingFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.pickingFramebuffer);
    
    // Create texture for color attachment
    state.pickingTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, state.pickingTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, state.canvas.width, state.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.pickingTexture, 0);
    
    // Create renderbuffer for depth attachment
    state.pickingDepthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, state.pickingDepthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, state.canvas.width, state.canvas.height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, state.pickingDepthBuffer);
    
    // Unbind
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawModelForPicking(modelName, pickingColor) {
    const model = state.models[modelName];
    if (!model) return;
    
    const gl = state.gl;
    const program = state.pickingShaderProgram;
    
    // Bind buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, model.positionBuffer);
    gl.vertexAttribPointer(program.aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(program.aPosition);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
    
    // Set matrices
    const modelViewMatrix = getCurrentMatrix();
    gl.uniformMatrix4fv(program.uModelViewMatrix, false, modelViewMatrix);
    
    // Set picking color
    const normalizedColor = [
        pickingColor[0] / 255,
        pickingColor[1] / 255,
        pickingColor[2] / 255,
        pickingColor[3] / 255
    ];
    gl.uniform4fv(program.uPickingColor, normalizedColor);
    
    // Draw
    gl.drawElements(gl.TRIANGLES, model.indexCount, gl.UNSIGNED_SHORT, 0);
}

function renderForPicking(time) {
    const gl = state.gl;
    
    // Render to picking framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.pickingFramebuffer);
    gl.viewport(0, 0, state.canvas.width, state.canvas.height);
    
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    gl.useProgram(state.pickingShaderProgram);
    
    // Set up projection matrix
    const projectionMatrix = mat4.create();
    const aspect = state.canvas.width / state.canvas.height;
    mat4.perspective(projectionMatrix, Math.PI / 4, aspect, 0.1, 1000.0);
    gl.uniformMatrix4fv(state.pickingShaderProgram.uProjectionMatrix, false, projectionMatrix);
    
    // Set up view matrix
    const cameraPos = getCameraPosition();
    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, cameraPos, state.camera.target, [0, 1, 0]);
    
    // Initialize matrix stack
    state.matrixStack = [viewMatrix];
    
    // Draw robot with picking colors
    drawBodyForPicking(time);
    
    // Unbind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function drawBodyForPicking(time) {
    const transform = getTransformForPart('Body', time);
    
    pushMatrix();
    applyTransform(transform.translation, transform.rotation);
    drawModelForPicking('body', PART_COLORS['Body']);
    
    drawHeadForPicking(time);
    drawUpperLegForPicking('FL', time);
    drawUpperLegForPicking('FR', time);
    drawUpperLegForPicking('BL', time);
    drawUpperLegForPicking('BR', time);
    
    popMatrix();
}

function drawHeadForPicking(time) {
    const transform = getTransformForPart('Head', time);
    
    pushMatrix();
    applyTransform(transform.translation, transform.rotation);
    drawModelForPicking('head', PART_COLORS['Head']);
    popMatrix();
}

function drawUpperLegForPicking(legId, time) {
    const upperName = 'UpperLeg' + legId;
    const lowerName = 'LowerLeg' + legId;
    
    const transform = getTransformForPart(upperName, time);
    
    pushMatrix();
    applyTransform(transform.translation, transform.rotation);
    drawModelForPicking('upper_leg', PART_COLORS[upperName]);
    
    drawLowerLegForPicking(legId, time);
    
    popMatrix();
}

function drawLowerLegForPicking(legId, time) {
    const lowerName = 'LowerLeg' + legId;
    const transform = getTransformForPart(lowerName, time);
    
    pushMatrix();
    applyTransform(transform.translation, transform.rotation);
    drawModelForPicking('lower_leg', PART_COLORS[lowerName]);
    popMatrix();
}

function handlePicking(event) {
    const gl = state.gl;
    const rect = state.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = rect.height - (event.clientY - rect.top) - 1; // Flip Y coordinate
    
    // Render scene for picking
    renderForPicking(state.animation.currentTime);
    
    // Read pixel
    const pixelData = new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.pickingFramebuffer);
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    
    const id = pixelData[0];
    
    // Find part by ID
    let partName = null;
    for (const [name, color] of Object.entries(PART_COLORS)) {
        if (color[0] === id) {
            partName = name;
            break;
        }
    }
    
    if (partName) {
        // Add or select keyframe at current time
        addKeyframe(partName, state.animation.currentTime);
        console.log('Clicked on:', partName);
    } else if (state.gizmo.visible) {
        // Check if clicked on gizmo
        handleGizmoPicking(event);
    }
}

// ============================================================================
// Gizmo System
// ============================================================================

function updateGizmoPosition() {
    if (!state.selectedKeyframe) {
        state.gizmo.visible = false;
        return;
    }
    
    const { partName } = state.selectedKeyframe;
    const transform = getTransformForPart(partName, state.animation.currentTime);
    
    // Calculate world position of the part
    const worldPos = getPartWorldPosition(partName, state.animation.currentTime);
    state.gizmo.position = worldPos;
}

function getPartWorldPosition(partName, time) {
    const cameraPos = getCameraPosition();
    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, cameraPos, state.camera.target, [0, 1, 0]);
    
    // Build transform chain to this part
    state.matrixStack = [viewMatrix];
    
    const worldMatrix = getPartWorldMatrix(partName, time);
    
    // Extract position from matrix
    return [worldMatrix[12], worldMatrix[13], worldMatrix[14]];
}

function getPartWorldMatrix(partName, time) {
    // This is similar to our drawing code but only accumulates matrices
    const parts = {
        'Body': () => {
            const t = getTransformForPart('Body', time);
            pushMatrix();
            applyTransform(t.translation, t.rotation);
            const m = mat4.clone(getCurrentMatrix());
            popMatrix();
            return m;
        },
        'Head': () => {
            const bodyT = getTransformForPart('Body', time);
            pushMatrix();
            applyTransform(bodyT.translation, bodyT.rotation);
            const headT = getTransformForPart('Head', time);
            applyTransform(headT.translation, headT.rotation);
            const m = mat4.clone(getCurrentMatrix());
            popMatrix();
            return m;
        }
    };
    
    // Handle legs
    const legPattern = /^(Upper|Lower)Leg(FL|FR|BL|BR)$/;
    const match = partName.match(legPattern);
    if (match) {
        const isUpper = match[1] === 'Upper';
        const legId = match[2];
        
        const bodyT = getTransformForPart('Body', time);
        pushMatrix();
        applyTransform(bodyT.translation, bodyT.rotation);
        
        const upperName = 'UpperLeg' + legId;
        const upperT = getTransformForPart(upperName, time);
        applyTransform(upperT.translation, upperT.rotation);
        
        if (!isUpper) {
            const lowerName = partName;
            const lowerT = getTransformForPart(lowerName, time);
            applyTransform(lowerT.translation, lowerT.rotation);
        }
        
        const m = mat4.clone(getCurrentMatrix());
        popMatrix();
        return m;
    }
    
    // Default to body if part not found
    return parts['Body'] ? parts['Body']() : mat4.create();
}

function createArrowGeometry() {
    // Simple arrow along Z axis (to be rotated for X and Y)
    const positions = [];
    const colors = [];
    
    // Shaft (line from origin to tip)
    const shaftLength = 1.0;
    positions.push(0, 0, 0, 0, 0, shaftLength);
    
    // Arrow head (cone approximation)
    const headLength = 0.2;
    const headRadius = 0.1;
    const segments = 8;
    
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * headRadius;
        const y = Math.sin(angle) * headRadius;
        positions.push(x, y, shaftLength - headLength);
        positions.push(0, 0, shaftLength);
    }
    
    return new Float32Array(positions);
}

function drawGizmo(projectionMatrix, viewMatrix) {
    const gl = state.gl;
    const gizmoSize = 0.5;
    
    // Disable depth test so gizmo is always visible
    gl.disable(gl.DEPTH_TEST);
    
    gl.useProgram(state.pickingShaderProgram);
    gl.uniformMatrix4fv(state.pickingShaderProgram.uProjectionMatrix, false, projectionMatrix);
    
    // Create translation to gizmo position
    const gizmoMatrix = mat4.create();
    mat4.multiply(gizmoMatrix, viewMatrix, gizmoMatrix);
    mat4.translate(gizmoMatrix, gizmoMatrix, state.gizmo.position);
    
    // Draw 3 axes
    drawGizmoArrow(gizmoMatrix, [1, 0, 0], [1, 0, 0, 1], gizmoSize); // X - Red
    drawGizmoArrow(gizmoMatrix, [0, 1, 0], [0, 1, 0, 1], gizmoSize); // Y - Green
    drawGizmoArrow(gizmoMatrix, [0, 0, 1], [0, 0, 1, 1], gizmoSize); // Z - Blue
    
    // Draw rotation rings
    if (state.gizmo.mode === 'rotate') {
        drawGizmoRing(gizmoMatrix, [1, 0, 0], [1, 0.5, 0.5, 0.6], gizmoSize * 1.2);
        drawGizmoRing(gizmoMatrix, [0, 1, 0], [0.5, 1, 0.5, 0.6], gizmoSize * 1.2);
        drawGizmoRing(gizmoMatrix, [0, 0, 1], [0.5, 0.5, 1, 0.6], gizmoSize * 1.2);
    }
    
    // Re-enable depth test
    gl.enable(gl.DEPTH_TEST);
}

function drawGizmoArrow(baseMatrix, direction, color, length) {
    const gl = state.gl;
    
    // Create arrow geometry
    const positions = [];
    
    // Shaft (thick line)
    const shaftThickness = 0.02;
    positions.push(0, 0, 0);
    positions.push(
        direction[0] * length,
        direction[1] * length,
        direction[2] * length
    );
    
    // Cone tip
    const tipLength = length * 0.15;
    const tipRadius = length * 0.05;
    const tipStart = length - tipLength;
    
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const perpX = direction[1];
        const perpY = -direction[0];
        
        positions.push(
            direction[0] * tipStart + perpX * tipRadius * Math.cos(angle),
            direction[1] * tipStart + perpY * tipRadius * Math.cos(angle),
            direction[2] * tipStart + tipRadius * Math.sin(angle)
        );
        positions.push(
            direction[0] * length,
            direction[1] * length,
            direction[2] * length
        );
    }
    
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    gl.vertexAttribPointer(state.pickingShaderProgram.aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(state.pickingShaderProgram.aPosition);
    
    gl.uniformMatrix4fv(state.pickingShaderProgram.uModelViewMatrix, false, baseMatrix);
    gl.uniform4fv(state.pickingShaderProgram.uPickingColor, color);
    
    gl.lineWidth(3);
    gl.drawArrays(gl.LINES, 0, 2);
    gl.drawArrays(gl.LINES, 2, positions.length / 3 - 2);
    
    gl.deleteBuffer(buffer);
}

function drawGizmoRing(baseMatrix, axis, color, radius) {
    const gl = state.gl;
    const segments = 32;
    const positions = [];
    
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const cos = Math.cos(angle) * radius;
        const sin = Math.sin(angle) * radius;
        
        if (axis[0] === 1) { // YZ plane (X axis)
            positions.push(0, cos, sin);
        } else if (axis[1] === 1) { // XZ plane (Y axis)
            positions.push(cos, 0, sin);
        } else { // XY plane (Z axis)
            positions.push(cos, sin, 0);
        }
    }
    
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    gl.vertexAttribPointer(state.pickingShaderProgram.aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(state.pickingShaderProgram.aPosition);
    
    gl.uniformMatrix4fv(state.pickingShaderProgram.uModelViewMatrix, false, baseMatrix);
    gl.uniform4fv(state.pickingShaderProgram.uPickingColor, color);
    
    gl.lineWidth(2);
    gl.drawArrays(gl.LINE_STRIP, 0, positions.length / 3);
    
    gl.deleteBuffer(buffer);
}

function handleGizmoPicking(event) {
    if (!state.gizmo.visible) return;
    
    const rect = state.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Project gizmo position to screen space
    const gl = state.gl;
    const cameraPos = getCameraPosition();
    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, cameraPos, state.camera.target, [0, 1, 0]);
    
    const projectionMatrix = mat4.create();
    const aspect = state.canvas.width / state.canvas.height;
    mat4.perspective(projectionMatrix, Math.PI / 4, aspect, 0.1, 1000.0);
    
    // Get gizmo center in screen space
    const gizmoWorldPos = [...state.gizmo.position, 1];
    const viewPos = multiplyMatrixVector(viewMatrix, gizmoWorldPos);
    const clipPos = multiplyMatrixVector(projectionMatrix, viewPos);
    
    if (clipPos[3] === 0) return;
    
    const ndcX = clipPos[0] / clipPos[3];
    const ndcY = clipPos[1] / clipPos[3];
    
    const screenX = (ndcX + 1) * 0.5 * state.canvas.width;
    const screenY = (1 - ndcY) * 0.5 * state.canvas.height;
    
    // Check distance to gizmo center
    const dx = mouseX - screenX;
    const dy = mouseY - screenY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Determine which axis based on mouse position relative to gizmo center
    const threshold = 50;
    if (distance < threshold) {
        const angle = Math.atan2(dy, dx);
        
        // Determine axis based on angle
        if (Math.abs(dx) > Math.abs(dy)) {
            state.gizmo.selectedAxis = dx > 0 ? 'x' : 'x';
        } else {
            state.gizmo.selectedAxis = dy > 0 ? 'y' : 'y';
        }
        
        state.gizmo.isDragging = true;
        state.gizmo.dragStart = { x: event.clientX, y: event.clientY };
        console.log('Gizmo axis selected:', state.gizmo.selectedAxis);
    }
}

function multiplyMatrixVector(mat, vec) {
    return [
        mat[0] * vec[0] + mat[4] * vec[1] + mat[8] * vec[2] + mat[12] * vec[3],
        mat[1] * vec[0] + mat[5] * vec[1] + mat[9] * vec[2] + mat[13] * vec[3],
        mat[2] * vec[0] + mat[6] * vec[1] + mat[10] * vec[2] + mat[14] * vec[3],
        mat[3] * vec[0] + mat[7] * vec[1] + mat[11] * vec[2] + mat[15] * vec[3]
    ];
}

function handleGizmoDrag(deltaX, deltaY) {
    if (!state.gizmo.isDragging || !state.gizmo.selectedAxis || !state.selectedKeyframe) return;
    
    const { partName, keyframeIndex } = state.selectedKeyframe;
    const keyframes = state.animation.keyframes[partName];
    if (!keyframes || keyframeIndex < 0 || keyframeIndex >= keyframes.length) return;
    
    const keyframe = keyframes[keyframeIndex];
    
    if (state.gizmo.mode === 'translate') {
        const sensitivity = 0.01;
        const axisIndex = { x: 0, y: 1, z: 2 }[state.gizmo.selectedAxis];
        
        if (state.gizmo.selectedAxis === 'x') {
            keyframe.translation[axisIndex] += deltaX * sensitivity;
        } else if (state.gizmo.selectedAxis === 'y') {
            keyframe.translation[axisIndex] -= deltaY * sensitivity; // Invert Y
        } else if (state.gizmo.selectedAxis === 'z') {
            keyframe.translation[axisIndex] += deltaX * sensitivity;
        }
    } else if (state.gizmo.mode === 'rotate') {
        const sensitivity = 0.02;
        const axisIndex = { x: 0, y: 1, z: 2 }[state.gizmo.selectedAxis];
        
        // Use combined mouse movement for rotation
        const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY) * Math.sign(deltaX + deltaY);
        keyframe.rotation[axisIndex] += movement * sensitivity;
    }
    
    updateControlsPanel();
    updateGizmoPosition();
    render();
}

// ============================================================================
// Save/Load
// ============================================================================

function saveKeyframes() {
    const data = {
        duration: state.animation.duration,
        keyframes: state.animation.keyframes
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'robot_animation.json';
    a.click();
    
    URL.revokeObjectURL(url);
}

function loadKeyframes() {
    console.log('Opening file picker...');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    
    // Add to DOM temporarily
    document.body.appendChild(input);
    
    input.addEventListener('change', (e) => {
        console.log('File selected');
        const file = e.target.files[0];
        
        // Remove input from DOM
        document.body.removeChild(input);
        
        if (!file) {
            console.log('No file selected');
            return;
        }
        
        console.log('Reading file:', file.name);
        const reader = new FileReader();
        
        reader.onerror = (error) => {
            console.error('FileReader error:', error);
            alert('Error reading file: ' + error);
        };
        
        reader.onload = (event) => {
            try {
                console.log('File loaded, parsing JSON...');
                console.log('Raw content length:', event.target.result.length);
                const data = JSON.parse(event.target.result);
                console.log('JSON parsed successfully:', data);
                applyAnimationData(data);
                console.log('Animation applied successfully!');
            } catch (err) {
                alert('Error loading file: ' + err.message);
                console.error('Error loading animation:', err);
                console.error('File content:', event.target.result);
            }
        };
        reader.readAsText(file);
    });
    
    // Trigger click
    setTimeout(() => {
        input.click();
    }, 100);
}

// Load animation from URL
async function loadAnimationFromFile(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.statusText}`);
        }
        const data = await response.json();
        applyAnimationData(data);
        console.log(`Loaded animation from ${url}`);
    } catch (err) {
        console.error('Error loading animation file:', err);
        throw err;
    }
}

// Apply animation data to the state
function applyAnimationData(data) {
    console.log('Applying animation data:', data);
    
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid animation data');
    }
    
    // Reset animation state
    state.animation.isPlaying = false;
    state.animation.duration = data.duration || 5.0;
    state.animation.keyframes = data.keyframes || {};
    state.animation.currentTime = 0;
    state.selectedKeyframe = null;
    state.gizmo.visible = false;
    
    console.log('Duration set to:', state.animation.duration);
    console.log('Keyframes loaded:', Object.keys(state.animation.keyframes));
    console.log('Total parts with keyframes:', Object.keys(state.animation.keyframes).length);
    
    // Update UI
    const durationInput = document.getElementById('duration-input');
    if (durationInput) {
        durationInput.value = state.animation.duration;
    }
    
    updateTimelineDisplay();
    updatePlayheadPosition();
    updateControlsPanel();
    render();
    
    console.log('✅ Animation loaded successfully!');
    
    // Visual confirmation
    setTimeout(() => {
        alert(`Animation loaded!\nDuration: ${state.animation.duration}s\nParts: ${Object.keys(state.animation.keyframes).join(', ')}`);
    }, 100);
}

// ============================================================================
// Animation Loop
// ============================================================================

let lastTime = 0;

function animate(currentTime) {
    currentTime *= 0.001; // Convert to seconds
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    updateAnimation(deltaTime);
    render();
    
    requestAnimationFrame(animate);
}

// ============================================================================
// Initialization
// ============================================================================

async function init() {
    console.log('Initializing WebGL application...');
    
    if (!initWebGL()) {
        return;
    }
    
    if (!initShaders()) {
        alert('Failed to initialize shaders!');
        return;
    }
    
    console.log('Loading models...');
    await loadAllModels();
    
    initPickingFramebuffer();
    initTimeline();
    initControls();
    initCameraControls();
    
    console.log('Starting animation loop...');
    console.log('Tip: Use the Load button to load animation files, or create your own animation!');
    requestAnimationFrame(animate);
}

// Start the application when page loads
window.addEventListener('load', init);


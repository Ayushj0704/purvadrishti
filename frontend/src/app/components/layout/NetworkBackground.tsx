import { useEffect, useRef } from "react";

export function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, antialias: true }) as WebGLRenderingContext;
    if (!gl) return;

    // Helper to compile shaders
    function loadShader(type: number, source: string) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vsSource = `
      attribute vec2 aVertexPosition;
      attribute vec4 aVertexColor;
      varying vec4 vColor;
      void main(void) {
        gl_Position = vec4(aVertexPosition, 0.0, 1.0);
        gl${"_"}PointSize = 2.0;
        vColor = aVertexColor;
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec4 vColor;
      void main(void) {
        gl_FragColor = vColor;
      }
    `;

    const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;

    const shaderProgram = gl.createProgram();
    if (!shaderProgram) return;
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(shaderProgram));
      return;
    }

    gl.useProgram(shaderProgram);

    const positionAttributeLocation = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    const colorAttributeLocation = gl.getAttribLocation(shaderProgram, "aVertexColor");

    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.enableVertexAttribArray(colorAttributeLocation);

    const positionBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();

    // Particle logic
    const particleCount = 100;
    const particles = new Float32Array(particleCount * 4); // x, y, vx, vy
    for (let i = 0; i < particleCount; i++) {
      particles[i * 4] = Math.random() * window.innerWidth;
      particles[i * 4 + 1] = Math.random() * window.innerHeight;
      particles[i * 4 + 2] = (Math.random() - 0.5) * 1.5;
      particles[i * 4 + 3] = (Math.random() - 0.5) * 1.5;
    }

    const connectDistance = 120;
    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const hexToRgb = (hex: number) => {
      return [
        ((hex >> 16) & 255) / 255,
        ((hex >> 8) & 255) / 255,
        (hex & 255) / 255,
      ];
    };
    const nodeColor = hexToRgb(0x6f78ff);
    const edgeColor = hexToRgb(0x3d46ff);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Update positions
      for (let i = 0; i < particleCount; i++) {
        let x = particles[i * 4];
        let y = particles[i * 4 + 1];
        let vx = particles[i * 4 + 2];
        let vy = particles[i * 4 + 3];

        x += vx;
        y += vy;

        if (x < 0 || x > width) vx *= -1;
        if (y < 0 || y > height) vy *= -1;

        particles[i * 4] = x;
        particles[i * 4 + 1] = y;
        particles[i * 4 + 2] = vx;
        particles[i * 4 + 3] = vy;
      }

      // Build geometry
      // Vertices array: points first, then lines
      // Size: (particleCount + maxLines * 2) * 2
      const positions = [];
      const colors = [];

      // Add points
      for (let i = 0; i < particleCount; i++) {
        const x = (particles[i * 4] / width) * 2 - 1;
        const y = (particles[i * 4 + 1] / height) * -2 + 1;
        positions.push(x, y);
        colors.push(nodeColor[0], nodeColor[1], nodeColor[2], 0.8);
      }

      // Add lines
      let lineCount = 0;
      for (let i = 0; i < particleCount; i++) {
        for (let j = i + 1; j < particleCount; j++) {
          const dx = particles[i * 4] - particles[j * 4];
          const dy = particles[i * 4 + 1] - particles[j * 4 + 1];
          const distSq = dx * dx + dy * dy;

          if (distSq < connectDistance * connectDistance) {
            const alpha = 1.0 - Math.sqrt(distSq) / connectDistance;
            
            const x1 = (particles[i * 4] / width) * 2 - 1;
            const y1 = (particles[i * 4 + 1] / height) * -2 + 1;
            const x2 = (particles[j * 4] / width) * 2 - 1;
            const y2 = (particles[j * 4 + 1] / height) * -2 + 1;

            positions.push(x1, y1, x2, y2);
            colors.push(edgeColor[0], edgeColor[1], edgeColor[2], alpha * 0.4);
            colors.push(edgeColor[0], edgeColor[1], edgeColor[2], alpha * 0.4);
            lineCount++;
          }
        }
      }

      // Render
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Points
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(colorAttributeLocation, 4, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, particleCount);
      if (lineCount > 0) {
        gl.drawArrays(gl.LINES, particleCount, lineCount * 2);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen"
    />
  );
}

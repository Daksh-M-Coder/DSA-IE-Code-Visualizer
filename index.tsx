/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { setElementInnerHtml } from "safevalues/dom";
import { sanitizeHtml } from "safevalues";

// --- GEMINI API SETUP ---
let ai;
try {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} catch (error) {
  console.error(
    "Gemini API key not found. Chatbot functionality will be disabled.",
    error
  );
}

// --- TYPE DEFINITIONS ---
type NodeType =
  | "file"
  | "function"
  | "class"
  | "variable"
  | "query"
  | "table"
  | "generic";
type NodeData = {
  id: string;
  label: string;
  type: NodeType;
  filePath?: string;
  code?: string;
  lineCount?: number;
  complexity?: number;
  parent?: string;
  color?: string;
  icon?: string;
};
type Node = NodeData & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
  mass: number;
};
type Edge = {
  source: string;
  target: string;
  weight: number;
};
type GraphData = {
  nodes: Node[];
  edges: Edge[];
};

// --- DOM ELEMENT SELECTOR ---
const $ = (selector: string) => document.querySelector(selector) as HTMLElement;

class CodeGraphVisualizer {
  // --- STATE ---
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private graph: GraphData = { nodes: [], edges: [] };
  private activeGraph: GraphData = { nodes: [], edges: [] };
  private width = 0;
  private height = 0;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private isDragging = false;
  private isPanning = false;
  private draggedNode: Node | null = null;
  private hoveredNode: Node | null = null;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private animationFrameId: number | null = null;
  private isSimulationRunning = true;

  private selectedNode: Node | null = null;
  private currentView: "global" | "local" = "global";

  // --- UI ELEMENTS ---
  private tooltip = $("#tooltip");
  private sidebarContent = $("#sidebar-content");
  // FIX: Cast the result of `$` to the specific element type instead of using generics.
  private searchInput = $("#search-input") as HTMLInputElement;
  // FIX: Cast the result of `$` to the specific element type instead of using generics.
  private depthSlider = $("#depth-slider") as HTMLInputElement;
  private depthValue = $("#depth-value");

  // --- PHYSICS CONSTANTS ---
  private readonly REPEL_STRENGTH = -1000;
  private readonly ATTRACT_STRENGTH = 0.05;
  private readonly DAMPING = 0.9;
  private readonly MAX_VELOCITY = 10;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.resizeCanvas();
    this.initEventListeners();
    this.initGeminiChatbot();
  }

  // --- INITIALIZATION ---
  private resizeCanvas() {
    this.width = this.canvas.offsetWidth;
    this.height = this.canvas.offsetHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.panX = this.width / 2;
    this.panY = this.height / 2;
  }

  private initEventListeners() {
    window.addEventListener("resize", this.resizeCanvas.bind(this));
    // Canvas interaction
    this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this));
    this.canvas.addEventListener("mouseleave", this.onMouseUp.bind(this));
    this.canvas.addEventListener("wheel", this.onWheel.bind(this));
    this.canvas.addEventListener("dblclick", this.onDoubleClick.bind(this));

    // File handling
    $("#upload-btn").addEventListener("click", () =>
      // FIX: Cast the result of `$` to the specific element type instead of using generics.
      ($("#file-input") as HTMLInputElement).click()
    );
    // FIX: Cast the result of `$` to the specific element type instead of using generics.
    ($("#file-input") as HTMLInputElement).addEventListener(
      "change",
      this.handleFileUpload.bind(this)
    );
    document.body.addEventListener("dragover", this.handleDragOver.bind(this));
    document.body.addEventListener("dragleave", this.handleDragLeave.bind(this));
    document.body.addEventListener("drop", this.handleDrop.bind(this));

    // Paste modal
    $("#paste-code-btn").addEventListener("click", () =>
      $("#paste-modal").classList.remove("hidden")
    );
    $("#paste-cancel-btn").addEventListener("click", () =>
      $("#paste-modal").classList.add("hidden")
    );
    $("#paste-submit-btn").addEventListener(
      "click",
      this.handlePasteSubmit.bind(this)
    );

    // Header controls
    $("#theme-select").addEventListener(
      "change",
      this.handleThemeChange.bind(this)
    );
    this.searchInput.addEventListener("input", this.filterGraph.bind(this));
    this.depthSlider.addEventListener("input", this.filterGraph.bind(this));
  }

  // --- FILE HANDLING & PARSING ---
  private async handleFileUpload(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (!files) return;
    this.processFiles(Array.from(files));
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    $("#drop-zone").classList.remove("hidden");
  }

  private handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    $("#drop-zone").classList.add("hidden");
  }

  private async handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    $("#drop-zone").classList.add("hidden");
    const files = e.dataTransfer?.files;
    if (files) this.processFiles(Array.from(files));
  }
  
  private handlePasteSubmit() {
    // FIX: Cast the result of `$` to the specific element type instead of using generics.
    const textarea = $("#paste-textarea") as HTMLTextAreaElement;
    const code = textarea.value;
    if (code.trim()) {
        const file = new File([code], "pasted_snippet.js", { type: "text/javascript"});
        this.processFiles([file]);
    }
    textarea.value = '';
    $("#paste-modal").classList.add("hidden");
  }

  private async processFiles(files: File[]) {
    if (files.length > 50) {
      alert("Please select a maximum of 50 files.");
      return;
    }
    // FIX: Use a type that accepts `NodeData` before the graph is initialized with physics properties.
    const newGraph: { nodes: NodeData[]; edges: Edge[] } = { nodes: [], edges: [] };

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        console.warn(`Skipping large file: ${file.name}`);
        continue;
      }
      const content = await file.text();
      const { nodes, edges } = this.parseFile(file.name, content);
      newGraph.nodes.push(...nodes);
      newGraph.edges.push(...edges);
    }
    
    // Naive import linking
    this.linkImports(newGraph);

    this.loadGraph(newGraph);
  }

  private parseFile(
    fileName: string,
    content: string
  ): { nodes: NodeData[]; edges: Edge[] } {
    const fileId = `file:${fileName}`;
    const extension = fileName.split(".").pop()?.toLowerCase() || "";

    const iconMap = {
      py: "fas fa-code",
      java: "fab fa-java",
      sql: "fas fa-database",
      db: "fas fa-database",
      json: "fas fa-file-code",
      csv: "fas fa-file-csv",
      xml: "fas fa-file-code",
      md: "fab fa-markdown",
      c: "fas fa-code",
      cpp: "fas fa-code",
      js: "fab fa-js-square",
    };

    const fileNode: NodeData = {
      id: fileId,
      label: fileName,
      type: "file",
      filePath: fileName,
      code: content,
      lineCount: content.split("\n").length,
      icon: iconMap[extension] || "fas fa-file-alt",
    };
    const nodes: NodeData[] = [fileNode];
    const edges: Edge[] = [];
    
    // Simplified regex-based parsing
    let funcs: RegExpMatchArray[] = [];
    if (['py', 'js'].includes(extension)) {
        funcs = [...content.matchAll(/(?:function|def)\s+([a-zA-Z0-9_]+)\s*\(/g)];
    } else if (['java', 'c', 'cpp'].includes(extension)) {
        funcs = [...content.matchAll(/[a-zA-Z0-9_<>]+\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{/g)];
    }

    funcs.forEach(match => {
        const funcName = match[1];
        const funcId = `func:${fileName}/${funcName}`;
        nodes.push({ id: funcId, label: funcName, type: 'function', parent: fileId });
        edges.push({ source: fileId, target: funcId, weight: 1 });
    });


    return { nodes, edges };
  }
  
  // FIX: Update signature to accept graph data with `NodeData` objects.
  private linkImports(graph: { nodes: NodeData[]; edges: Edge[] }) {
      const fileNodes = graph.nodes.filter(n => n.type === 'file');
      fileNodes.forEach(fileNode => {
          if (!fileNode.code) return;
          const importRegex = /(?:import|from)\s+([a-zA-Z0-9_.]+)|require\(['"]([^'"]+)['"]\)/g;
          let match;
          while((match = importRegex.exec(fileNode.code)) !== null) {
              const moduleName = match[1] || match[2];
              const targetFile = fileNodes.find(f => f.label.startsWith(moduleName));
              if (targetFile && targetFile.id !== fileNode.id) {
                  graph.edges.push({source: fileNode.id, target: targetFile.id, weight: 2});
              }
          }
      });
  }


  // --- GRAPH MANAGEMENT ---
  // FIX: Update signature to accept raw `NodeData` for initialization.
  public loadGraph(data: { nodes: NodeData[]; edges: Edge[] }) {
    this.graph = {
      nodes: data.nodes.map((n, i) => ({
        ...n,
        x: this.width / 2 + (Math.random() - 0.5) * 100,
        y: this.height / 2 + (Math.random() - 0.5) * 100,
        vx: 0,
        vy: 0,
        mass: n.type === "file" ? 5 : 1,
      })),
      edges: data.edges,
    };
    this.activeGraph = this.graph;
    this.isSimulationRunning = true;
    if (!this.animationFrameId) this.startAnimation();
    this.filterGraph();
  }

  private filterGraph() {
    this.depthValue.textContent = this.depthSlider.value;
    const searchTerm = this.searchInput.value.toLowerCase();
    const maxDepth = parseInt(this.depthSlider.value);
    
    // --- Syllabus Comment: Using Breadth-First Search (BFS) for filtering by depth and keyword. ---
    // BFS is ideal here because it explores the graph layer by layer, which directly
    // corresponds to the "depth" from a central point.
    const filteredNodes = new Set<Node>();
    const filteredEdges = new Set<Edge>();

    const startNodes = this.graph.nodes.filter(n => 
        n.label.toLowerCase().includes(searchTerm)
    );

    if (startNodes.length === 0) {
        this.activeGraph = {nodes: [], edges: []};
        return;
    }
    
    const queue: [Node, number][] = startNodes.map(n => [n, 0]);
    const visited = new Set<string>(startNodes.map(n => n.id));

    while (queue.length > 0) {
        const [currentNode, depth] = queue.shift()!;
        filteredNodes.add(currentNode);

        if (depth >= maxDepth) continue;

        this.graph.edges.forEach(edge => {
            if (edge.source === currentNode.id || edge.target === currentNode.id) {
                const neighborId = edge.source === currentNode.id ? edge.target : edge.source;
                if (!visited.has(neighborId)) {
                    const neighborNode = this.graph.nodes.find(n => n.id === neighborId);
                    if (neighborNode) {
                        visited.add(neighborId);
                        queue.push([neighborNode, depth + 1]);
                    }
                }
                if (visited.has(edge.source) && visited.has(edge.target)) {
                    filteredEdges.add(edge);
                }
            }
        });
    }

    this.activeGraph = {
        nodes: Array.from(filteredNodes),
        edges: Array.from(filteredEdges),
    };
  }
  

  // --- INTERACTION HANDLERS ---
  private onMouseDown(e: MouseEvent) {
    const { x, y } = this.getMousePos(e);
    const targetNode = this.getNodeAt(x, y);

    if (targetNode) {
      this.isDragging = true;
      this.draggedNode = targetNode;
      this.draggedNode.fx = this.draggedNode.x;
      this.draggedNode.fy = this.draggedNode.y;
    } else {
      this.isPanning = true;
    }
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  private onMouseMove(e: MouseEvent) {
    const { x, y } = this.getMousePos(e);

    if (this.isDragging && this.draggedNode) {
      this.draggedNode.fx = x;
      this.draggedNode.fy = y;
    } else if (this.isPanning) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.panX += dx;
      this.panY += dy;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    } else {
      this.hoveredNode = this.getNodeAt(x, y);
      this.canvas.style.cursor = this.hoveredNode ? "pointer" : "grab";
      this.updateTooltip();
    }
  }

  private onMouseUp() {
    if (this.isDragging && this.draggedNode) {
        if(this.draggedNode.fx === this.draggedNode.x && this.draggedNode.fy === this.draggedNode.y) {
           this.selectNode(this.draggedNode);
        }
      this.draggedNode.fx = undefined;
      this.draggedNode.fy = undefined;
    }
    this.isDragging = false;
    this.isPanning = false;
    this.draggedNode = null;
  }
  
  private onDoubleClick(e: MouseEvent) {
      const { x, y } = this.getMousePos(e);
      const targetNode = this.getNodeAt(x, y);
      if(targetNode) {
          // --- Syllabus Comment: Using Depth-First Search (DFS) for local view. ---
          // DFS is suitable for exploring a single path deeply, which is what a "local"
          // or "call tree" view represents. It follows one branch of connections as far as possible.
          this.currentView = 'local';
          const localNodes = new Set<Node>([targetNode]);
          const localEdges = new Set<Edge>();
          const stack: Node[] = [targetNode];
          const visited = new Set<string>([targetNode.id]);

          while (stack.length > 0) {
              const currentNode = stack.pop()!;
              this.graph.edges.forEach(edge => {
                  if(edge.source === currentNode.id && !visited.has(edge.target)) {
                      const neighbor = this.graph.nodes.find(n => n.id === edge.target);
                      if (neighbor) {
                          visited.add(neighbor.id);
                          stack.push(neighbor);
                          localNodes.add(neighbor);
                          localEdges.add(edge);
                      }
                  }
              });
          }
          this.activeGraph = {nodes: Array.from(localNodes), edges: Array.from(localEdges)};
      } else {
          // Double click on background resets to global view
          this.currentView = 'global';
          this.filterGraph();
      }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = this.zoom * scaleFactor;

    if (newZoom < 0.2 || newZoom > 5) return;
    
    const mouseX = e.clientX - this.canvas.offsetLeft;
    const mouseY = e.clientY - this.canvas.offsetTop;
    
    this.panX = mouseX - (mouseX - this.panX) * scaleFactor;
    this.panY = mouseY - (mouseY - this.panY) * scaleFactor;
    this.zoom = newZoom;
  }
  
  private getMousePos(e: MouseEvent) {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - this.panX) / this.zoom;
      const y = (e.clientY - rect.top - this.panY) / this.zoom;
      return {x, y};
  }

  private getNodeAt(x: number, y: number): Node | null {
    let clickedNode = null;
    // Iterate backwards to prioritize nodes drawn on top
    for (let i = this.activeGraph.nodes.length - 1; i >= 0; i--) {
        const node = this.activeGraph.nodes[i];
        const radius = (node.type === "file" ? 15 : 8) / this.zoom;
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx * dx + dy * dy < radius * radius * this.zoom * this.zoom ) { // Compare in screen space for easier clicking
            clickedNode = node;
            break;
        }
    }
    return clickedNode;
  }

  // --- UI & THEME MANAGEMENT ---
  private selectNode(node: Node | null) {
    this.selectedNode = node;
    this.updateSidebar();
  }

  private updateSidebar() {
    if (this.selectedNode) {
      this.sidebarContent.classList.remove("empty");
      const { label, type, filePath, code, lineCount, icon } = this.selectedNode;
      const language = filePath?.split(".").pop() || "javascript";

      const sanitizedCode = sanitizeHtml(code || "No code snippet available.");

      const html = `
        <div class="code-header">
            <i class="${icon || "fas fa-question-circle"}"></i>
            <div>
                <h2 class="code-title">${label}</h2>
                <p class="code-type">${type}</p>
            </div>
        </div>
        <div class="code-metrics">
            <div class="metric-item"><span class="label">File:</span> <span class="value">${
              filePath || "N/A"
            }</span></div>
            <div class="metric-item"><span class="label">Lines:</span> <span class="value">${
              lineCount || "N/A"
            }</span></div>
        </div>
        <div class="codesnap-container">
            <pre><code class="language-${language}">${sanitizedCode.toString()}</code></pre>
        </div>
      `;
      setElementInnerHtml(this.sidebarContent, sanitizeHtml(html));
      (window as any).Prism?.highlightAll();
    } else {
      this.sidebarContent.classList.add("empty");
      setElementInnerHtml(
        this.sidebarContent,
        sanitizeHtml(`<p>Click a node to see details</p>`)
      );
    }
  }

  private updateTooltip() {
    if (this.hoveredNode) {
      this.tooltip.style.display = "block";
      this.tooltip.style.opacity = "1";
      
      const canvasRect = this.canvas.getBoundingClientRect();
      const nodeScreenX = this.hoveredNode.x * this.zoom + this.panX + canvasRect.left;
      const nodeScreenY = this.hoveredNode.y * this.zoom + this.panY + canvasRect.top;
      
      this.tooltip.style.left = `${nodeScreenX}px`;
      this.tooltip.style.top = `${nodeScreenY - 10}px`; // position above node
      
      const tooltipContent = `<strong>${this.hoveredNode.label}</strong><br>Type: ${this.hoveredNode.type}`;
      setElementInnerHtml(this.tooltip, sanitizeHtml(tooltipContent));
      
      // Adjust position to prevent going off-screen
      const tooltipRect = this.tooltip.getBoundingClientRect();
      this.tooltip.style.transform = `translate(-50%, -${tooltipRect.height}px)`;


    } else {
      this.tooltip.style.opacity = "0";
      this.tooltip.style.display = "none";
    }
  }

  private handleThemeChange(e: Event) {
    document.body.className = (e.target as HTMLSelectElement).value;
  }
  
  // --- GEMINI CHATBOT ---
  private initGeminiChatbot() {
    if (!ai) return;

    const toggleButton = $("#chatbot-toggle");
    const closeButton = $("#chatbot-close");
    const windowEl = $("#chatbot-window");
    const sendButton = $("#chatbot-send");
    // FIX: Cast the result of `$` to the specific element type instead of using generics.
    const textarea = $("#chatbot-textarea") as HTMLTextAreaElement;

    toggleButton.addEventListener("click", () => {
        windowEl.classList.remove("hidden");
        toggleButton.classList.add("hidden");
    });
    closeButton.addEventListener("click", () => {
        windowEl.classList.add("hidden");
        toggleButton.classList.remove("hidden");
    });
    sendButton.addEventListener("click", () => this.sendChatMessage());
    textarea.addEventListener("keydown", (e) => {
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendChatMessage();
        }
    });
  }

  private async sendChatMessage() {
      // FIX: Cast the result of `$` to the specific element type instead of using generics.
      const textarea = $("#chatbot-textarea") as HTMLTextAreaElement;
      const messagesContainer = $("#chatbot-messages");
      const prompt = textarea.value.trim();
      if (!prompt || !ai) return;

      this.addMessageToChat(prompt, 'user');
      textarea.value = '';

      let fullPrompt = prompt;
      if (this.selectedNode && this.selectedNode.code) {
          fullPrompt = `
Context: The user is viewing the following code from file "${this.selectedNode.filePath}".
--- CODE START ---
${this.selectedNode.code.substring(0, 5000)}
--- CODE END ---

User question: ${prompt}
`;
      }
      
      this.addMessageToChat('Thinking...', 'gemini', true);

      try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
        });
        const text = response.text;
        this.updateLastChatMessage(text);
      } catch (error) {
          console.error("Gemini API error:", error);
          this.updateLastChatMessage("Sorry, I encountered an error. Please try again.");
      }
  }
  
  private addMessageToChat(text: string, sender: 'user' | 'gemini', isTyping = false) {
      const messagesContainer = $("#chatbot-messages");
      const messageEl = document.createElement('div');
      messageEl.classList.add('chat-message', sender);
      if (isTyping) {
          messageEl.classList.add('typing');
      }
      setElementInnerHtml(messageEl, sanitizeHtml(text));
      messagesContainer.appendChild(messageEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  private updateLastChatMessage(text: string) {
      const typingMessage = $(".chat-message.typing");
      if(typingMessage) {
          setElementInnerHtml(typingMessage, sanitizeHtml(text));
          typingMessage.classList.remove('typing');
      }
  }


  // --- PHYSICS SIMULATION ---
  private updatePhysics() {
    if (!this.isSimulationRunning) return;

    const nodes = this.activeGraph.nodes;
    const edges = this.activeGraph.edges;
    
    // --- Syllabus Comment: Implementing a Force-Directed Graph Layout. ---
    // This simulates physical forces:
    // 1. Repulsion (Coulomb's Law): All nodes push each other away to prevent overlap.
    // 2. Attraction (Hooke's Law): Connected nodes (edges) pull each other together like springs.
    // This creates an organic, self-organizing layout.

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) dist = 0.1;

        const force = (this.REPEL_STRENGTH * n1.mass * n2.mass) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        n1.vx += fx / n1.mass;
        n1.vy += fy / n1.mass;
        n2.vx -= fx / n2.mass;
        n2.vy -= fy / n2.mass;
      }
    }

    // Attraction
    edges.forEach(edge => {
      const n1 = nodes.find(n => n.id === edge.source);
      const n2 = nodes.find(n => n.id === edge.target);
      if (!n1 || !n2) return;

      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const force = this.ATTRACT_STRENGTH * dist;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      n1.vx += fx / n1.mass;
      n1.vy += fy / n1.mass;
      n2.vx -= fx / n2.mass;
      n2.vy -= fy / n2.mass;
    });

    // Update positions
    nodes.forEach(node => {
      if(node.fx !== undefined) {
        node.x = node.fx;
        node.vx = 0;
      } else {
        node.vx *= this.DAMPING;
        // Cap velocity
        const speed = Math.sqrt(node.vx*node.vx + node.vy*node.vy);
        if (speed > this.MAX_VELOCITY) {
            node.vx = (node.vx / speed) * this.MAX_VELOCITY;
            node.vy = (node.vy / speed) * this.MAX_VELOCITY;
        }
        node.x += node.vx;
      }

      if(node.fy !== undefined) {
          node.y = node.fy;
          node.vy = 0;
      } else {
          node.vy *= this.DAMPING;
          node.y += node.vy;
      }
    });
  }

  // --- RENDERING ---
  private startAnimation() {
    const animate = () => {
      this.updatePhysics();
      this.draw();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private draw() {
    this.ctx.save();
    this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg-color');
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    // Draw edges
    this.ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--edge-color');
    this.ctx.lineWidth = 1 / this.zoom;
    this.activeGraph.edges.forEach(edge => {
      const n1 = this.activeGraph.nodes.find(n => n.id === edge.source);
      const n2 = this.activeGraph.nodes.find(n => n.id === edge.target);
      if (n1 && n2) {
        this.ctx.beginPath();
        this.ctx.moveTo(n1.x, n1.y);
        this.ctx.lineTo(n2.x, n2.y);
        this.ctx.stroke();
      }
    });

    // Draw nodes
    this.activeGraph.nodes.forEach(node => {
      const radius = node.type === "file" ? 15 : 8;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      
      const isHovered = this.hoveredNode?.id === node.id;
      const isSelected = this.selectedNode?.id === node.id;

      if(isHovered || isSelected) {
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = getComputedStyle(document.body).getPropertyValue('--node-glow-color');
      }

      this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--node-fill-color');
      this.ctx.fill();
      this.ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--node-stroke-color');
      this.ctx.lineWidth = isSelected ? 3 / this.zoom : 1.5 / this.zoom;
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;

      // Draw labels
      if (this.zoom > 0.5) {
          this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--node-text-color');
          this.ctx.font = `${12 / this.zoom}px ${getComputedStyle(document.body).getPropertyValue('--font-primary')}`;
          this.ctx.textAlign = "center";
          this.ctx.fillText(node.label, node.x, node.y + radius + 14 / this.zoom);
      }
    });

    this.ctx.restore();
  }
}

// --- APP ENTRY POINT ---
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("graph-canvas") as HTMLCanvasElement;
  if (canvas) {
    new CodeGraphVisualizer(canvas);
  }
});
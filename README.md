# CodeGraph Visualizer

A sophisticated, interactive web application for visualizing code structure and relationships through dynamic graph representations. This tool helps developers understand complex codebases by creating interactive visual maps of files, functions, classes, and their dependencies.

## 🚀 Features

### Core Visualization
- **Interactive Graph Canvas**: Force-directed graph layout that simulates physical forces for organic node arrangement
- **Multiple Node Types**: Support for files, functions, classes, variables, queries, tables, and generic nodes
- **Real-time Physics Simulation**: Nodes repel each other while edges act as springs for natural clustering
- **Zoom & Pan**: Smooth navigation through large code graphs with mouse wheel zoom and drag-to-pan
- **Node Selection**: Click nodes to view detailed code information in the sidebar

### Code Analysis & Display
- **Multi-language Support**: JavaScript, Python, Java, C, C++, SQL, and more
- **Syntax Highlighting**: Integrated Prism.js for beautiful code display
- **Code Metrics**: Line counts, file paths, and structural information
- **File Type Icons**: Visual indicators for different file types and programming languages

### Graph Navigation & Filtering
- **Search Functionality**: Real-time node filtering by name
- **Depth Control**: Adjustable exploration depth with slider (1-10 levels)
- **Breadth-First Search (BFS)**: Used for depth-based filtering to explore graph layers systematically
- **Depth-First Search (DFS)**: Used for local view/call tree exploration
- **Global vs Local Views**: Double-click nodes for focused local exploration

### AI Integration
- **Gemini AI Assistant**: Context-aware chatbot for code analysis and questions
- **Smart Context**: Automatically includes selected code in AI prompts
- **Real-time Chat**: Interactive conversation interface with typing indicators

### File Handling
- **Multiple Input Methods**:
  - File upload (supports up to 50 files)
  - Drag & drop interface
  - Direct code pasting
- **Import Linking**: Automatic detection of import/require statements
- **File Size Limits**: Intelligent handling of large files (up to 10MB)

## 🎨 Themes & Customization

Five carefully designed color themes:
- **Obsidian**: Dark professional theme (default)
- **Light**: Clean, high-contrast light mode
- **Hacker**: Matrix-inspired green-on-black
- **Solarized**: Popular developer color scheme
- **Nord**: Calm, Arctic-inspired palette

## 🛠 Technical Architecture

### Frontend Stack
- **TypeScript**: Full type safety and modern JavaScript features
- **HTML5 Canvas**: High-performance graph rendering
- **CSS3 Variables**: Dynamic theming system
- **Prism.js**: Syntax highlighting for code display
- **Font Awesome**: Comprehensive icon library
- **Google GenAI**: AI-powered code analysis

### Security Features
- **SafeValues**: Google's security library for DOM sanitization
- **Content Security**: Protected against XSS and injection attacks
- **File Size Validation**: Prevents performance issues with large files

### Algorithm Implementation

#### Graph Algorithms
1. **Force-Directed Layout**
   - Repulsion: Coulomb's law simulation between all nodes
   - Attraction: Hooke's law simulation along edges
   - Damping: Velocity reduction for stability
   - Mass-based physics: File nodes have higher mass than function nodes

2. **Breadth-First Search (BFS)**
   - Used for depth-based filtering
   - Explores graph layer by layer
   - Ideal for understanding connectivity at different depths

3. **Depth-First Search (DFS)**
   - Used for local view generation
   - Explores single paths deeply
   - Perfect for call tree and dependency chain analysis

#### Performance Optimizations
- **Animation Frame Management**: Efficient rendering loop
- **Velocity Capping**: Prevents simulation instability
- **Spatial Optimization**: Smart node collision detection
- **Selective Rendering**: Only renders visible elements

## 📁 Project Structure

```
codegraph-visualizer/
├── index.html          # Main application structure
├── index.css           # Comprehensive styling and themes
├── index.tsx           # TypeScript application logic
└── (generated assets)
```

### Key Components

#### HTML Structure
- **App Container**: Main flex layout container
- **Header**: Controls, search, and theme selector
- **Main Content**: Canvas and sidebar area
- **Modals**: File upload and paste interfaces
- **Chatbot**: AI assistant floating interface

#### CSS Architecture
- **CSS Variables**: Theme system with 10+ color variables
- **Responsive Design**: Flexbox-based layouts
- **Component Styling**: Modular CSS for each UI component
- **Animation System**: Smooth transitions and hover effects

#### TypeScript Modules
- **CodeGraphVisualizer Class**: Main application controller
- **Type Definitions**: Comprehensive TypeScript interfaces
- **Event Handlers**: Mouse, keyboard, and file interactions
- **Physics Engine**: Force simulation implementation
- **AI Integration**: Gemini chatbot functionality

## 🎯 Usage Guide

### Basic Operation
1. **Load Code**: Upload files, drag & drop, or paste code directly
2. **Navigate**: Use mouse to pan, scroll to zoom, click to select nodes
3. **Filter**: Use search and depth controls to focus on relevant parts
4. **Analyze**: Click nodes to view code details in sidebar
5. **Ask Questions**: Use Gemini chatbot for AI-powered insights

### Advanced Features
- **Double-click Nodes**: Switch to local view focusing on dependencies
- **Drag Nodes**: Manually reposition important nodes
- **Theme Switching**: Change visual theme for comfort or presentation
- **Export Graphs**: Save visualizations for documentation

### File Support
- **Programming Languages**: JavaScript, Python, Java, C, C++
- **Data Files**: JSON, CSV, XML
- **Markdown**: Documentation files
- **SQL**: Database schemas and queries

## 🔧 Development

### Setup Requirements
- Modern browser with ES6 module support
- TypeScript compilation (if modifying source)
- Google Gemini API key for AI features

### Building & Customization
The project uses native ES modules with import maps. Key dependencies:
- `@google/genai` for AI features
- `safevalues` for security
- `prism.js` for syntax highlighting
- `font-awesome` for icons

### Extending Functionality
- **New Parsers**: Add regex patterns in `parseFile()` method
- **Additional Themes**: Define new CSS variable sets
- **Custom Node Types**: Extend `NodeType` union and rendering logic
- **Export Formats**: Implement additional graph export options

## 📊 Performance Characteristics

- **File Limits**: 50 files maximum, 10MB per file
- **Node Capacity**: Hundreds of nodes with smooth performance
- **Rendering**: 60fps target on modern hardware
- **Memory**: Efficient garbage collection and object pooling

## 🛡 Security Considerations

- **DOM Sanitization**: All dynamic content is properly sanitized
- **File Validation**: Size and type checking before processing
- **API Security**: Secure AI API key handling
- **XSS Prevention**: SafeValues integration throughout

## 🌟 Educational Value

This project demonstrates several computer science concepts:
- **Graph Theory**: BFS, DFS, and graph traversal algorithms
- **Physics Simulation**: Force-directed layout algorithms
- **Human-Computer Interaction**: Intuitive visualization controls
- **Software Architecture**: Modular, type-safe application design
- **AI Integration**: Practical implementation of large language models

## 📝 License & Attribution

- Uses Google's SafeValues library for security
- Prism.js for syntax highlighting
- Font Awesome for icons
- Google Gemini AI for code analysis

---

*This tool is ideal for code review, architecture analysis, educational purposes, and understanding complex codebases through visual exploration.*

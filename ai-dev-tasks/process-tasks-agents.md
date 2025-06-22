# Task List Management with Sub-Agent Delegation

Guidelines for managing task lists in markdown files using sub-agents to accelerate progress on completing a PRD through intelligent task delegation and parallel processing.

## Task Implementation Strategy

### **Sub-Agent Delegation Approach:**
- **Identify parallelizable sub-tasks**: Group tasks that can be researched or prepared independently
- **Delegate research-heavy tasks**: Use sub-agents for codebase exploration, pattern analysis, and information gathering
- **Batch implementation**: After sub-agents complete research, implement multiple related sub-tasks efficiently
- **Strategic coordination**: Use sub-agent findings to inform implementation decisions

### **When to Use Sub-Agents:**

#### **Excellent for Sub-Agents:**
- **Codebase exploration**: "Find all existing cache implementations and patterns"
- **Pattern analysis**: "Analyze error handling patterns across service modules"
- **File discovery**: "Locate all configuration files and their purposes"
- **Research tasks**: "Search for similar forecasting logic in the codebase"
- **Documentation review**: "Find all TypeScript interfaces related to commodity data"
- **Test pattern analysis**: "Examine existing test structures and naming conventions"

#### **Keep for Main Agent:**
- **Code implementation**: Writing new functions, classes, and modules
- **File editing**: Making actual changes to existing code
- **Testing execution**: Running tests and validating implementations
- **Git operations**: Commits, merges, and repository management

### **Parallel Task Processing:**

#### **Phase 1: Research & Discovery (Sub-Agents)**
```markdown
- [ ] 1.1 Research existing patterns (SUB-AGENT)
- [ ] 1.2 Analyze related implementations (SUB-AGENT)  
- [ ] 1.3 Find configuration examples (SUB-AGENT)
- [ ] 1.4 Review test patterns (SUB-AGENT)
```

#### **Phase 2: Implementation (Main Agent)**
```markdown
- [ ] 1.5 Implement core functionality based on research
- [ ] 1.6 Create tests following discovered patterns
- [ ] 1.7 Add configuration using found examples
- [ ] 1.8 Integrate with existing systems
```

## Enhanced Completion Protocol

### **Sub-Agent Research Phase:**
1. **Identify research sub-tasks** that can be delegated
2. **Launch multiple sub-agents** concurrently for parallel research
3. **Collect and synthesize** sub-agent findings
4. **Update task list** with research insights and implementation guidance
5. **Mark research sub-tasks** as completed `[x]`

### **Implementation Phase:**
1. **Use sub-agent findings** to inform implementation approach
2. **Implement related sub-tasks** in batches based on research
3. **Test implementation** after each logical group of sub-tasks
4. **Mark implementation sub-tasks** as completed `[x]`

### **Parent Task Completion:**
1. When **all** subtasks underneath a parent task are `[x]`:
   - **First**: Run the full test suite (`npm test`, `pytest`, etc.)
   - **Only if all tests pass**: Stage changes (`git add .`)
   - **Clean up**: Remove temporary files and temporary code
   - **Commit**: Use descriptive commit message with conventional format:
     ```bash
     git commit -m "feat: implement futures data integration" \
                -m "- Add getFuturesContract() and getFuturesCurve() methods" \
                -m "- Implement data validation and caching" \
                -m "- Add comprehensive unit tests" \
                -m "Completes Task 1.0 from Market Consensus PRD"
     ```
2. **Mark parent task** as completed `[x]`

## Sub-Agent Task Templates

### **Research Template:**
```
Task Description: [Brief 3-5 word description]
Prompt: "Research and analyze [specific area] in the codebase:

1. Find all files related to [topic]
2. Analyze patterns and approaches used
3. Identify key interfaces, types, or configurations
4. Note any existing utilities or helpers
5. Document best practices and conventions found

Return a comprehensive summary including:
- File locations and their purposes
- Key patterns and approaches
- Reusable components or utilities
- Recommendations for new implementation
- Any potential conflicts or considerations"
```

### **Pattern Analysis Template:**
```
Task Description: [Brief 3-5 word description]  
Prompt: "Analyze [specific pattern] across the codebase:

1. Search for existing implementations of [pattern]
2. Document the structure and naming conventions
3. Identify common helper functions or utilities
4. Find test patterns and coverage approaches
5. Note any configuration or setup requirements

Provide detailed findings on:
- Implementation patterns and best practices
- Required dependencies or imports
- Test structure and naming conventions
- Integration points with existing systems
- Recommended approach for new implementation"
```

## Workflow Example

### **Traditional Approach (Sequential):**
```
1.1 Research futures API → WAIT → 1.2 Add method → WAIT → 1.3 Add tests → WAIT
```

### **Sub-Agent Approach (Parallel):**
```
Launch Sub-Agents:
├── Agent 1: Research Yahoo Finance patterns
├── Agent 2: Analyze caching implementations  
├── Agent 3: Find validation approaches
└── Agent 4: Review test structures

Collect Results → Implement 1.1-1.4 efficiently based on findings
```

## Task List Maintenance

### **Enhanced Tracking:**
1. **Mark sub-agent tasks**: Use `(SUB-AGENT)` suffix for delegated tasks
2. **Track research insights**: Add findings as sub-bullets under research tasks
3. **Update implementation guidance**: Include sub-agent recommendations in task descriptions
4. **Maintain "Relevant Files"**: Update with both researched and implemented files

### **Example Enhanced Task List:**
```markdown
- [x] 1.1 Research existing futures patterns (SUB-AGENT)
  • Found: `yahoo-finance-service.ts` has chart data methods
  • Pattern: Uses `getChart()` with interval/range parameters
  • Recommendation: Extend existing service rather than create new
- [x] 1.2 Analyze caching implementations (SUB-AGENT)  
  • Found: TTL-based caching in `cache-manager.ts`
  • Pattern: Service-level caching with configurable TTL
  • Recommendation: Use 1-4 hour TTL for futures data
- [ ] 1.3 Implement getFuturesContract() method
- [ ] 1.4 Add futures data caching with TTL
```

## AI Instructions for Sub-Agent Usage

When working with task lists, the AI must:

1. **Identify delegation opportunities**: Look for research, analysis, and discovery sub-tasks
2. **Launch sub-agents strategically**: Group related research tasks for parallel execution
3. **Synthesize findings**: Combine sub-agent results to inform implementation
4. **Update task list with insights**: Include research findings and recommendations
5. **Implement efficiently**: Use sub-agent findings to implement multiple related sub-tasks
6. **Follow completion protocol**: Mark tasks completed and commit when parent tasks finish
7. **Maintain coordination**: Ensure sub-agent findings align with overall implementation strategy

### **Sub-Agent Delegation Decision Tree:**
```
Is this sub-task about:
├── Finding/searching files? → SUB-AGENT
├── Analyzing patterns? → SUB-AGENT  
├── Research/discovery? → SUB-AGENT
├── Writing code? → MAIN AGENT
├── Running tests? → MAIN AGENT
└── Git operations? → MAIN AGENT
```

This approach leverages sub-agents for time-consuming research while keeping implementation coordinated and efficient.
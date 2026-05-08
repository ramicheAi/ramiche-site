# Case Study: First External Deployment

## Headline
"From Zero to 4-Agent AI Workforce in One Afternoon"

## Summary
Deployed a fully operational AI agent team on a Windows machine for an external client. The system includes 4 specialized agents (Operations, Sales, Customer Support, Content) running autonomously with persistent memory, scheduled tasks, and inter-agent coordination.

## Challenge
Client needed to automate repetitive business operations but lacked technical infrastructure. Running Windows (not macOS). No Node.js, no Git, no development environment. Needed a setup process that worked from scratch on a bare machine.

## Solution
Delivered the Parallax Enterprise Bundle — a self-contained deployment package that:
1. Auto-detects the operating system (macOS, Windows/WSL2, Linux)
2. Installs all dependencies (Node.js, Git, OpenClaw)
3. Deploys 4 custom agents with domain-specific identity files
4. Configures scheduled tasks, memory systems, and inter-agent messaging

## Process
- Client purchased Enterprise Bundle via Stripe checkout on parallax-site
- Downloaded zip file (22 files, 18KB)
- Ran PowerShell installer (Windows)
- Encountered and resolved: Execution Policy restrictions, missing Git, PATH updates
- OpenClaw installed, agents deployed, gateway running

## Results
- 4 autonomous agents deployed and operational
- Setup completed in one afternoon (including dependency installation on bare Windows)
- Agents running: Atlas (Operations), Mercury (Sales), Haven (Support), Ink (Content)
- Zero ongoing maintenance required

## Lessons Learned
1. Windows setup requires clear step-by-step PowerShell instructions
2. Execution Policy and admin access are common Windows blockers — script must handle gracefully
3. Real-time support during first deployment builds trust and uncovers UX gaps
4. Every friction point in the setup process = a customer lost. Invest in installer quality.

## Metrics
- Time to deploy: ~2 hours (including all dependency installation from scratch)
- Support interactions needed: ~10 (back-and-forth troubleshooting)
- Post-deploy issues: 0
- Customer satisfaction: Deployment completed successfully

## Quote
"First external deployment — proof the system works on real customer hardware." — Atlas

## Improvements Made Post-Deployment
- Added macOS 15 minimum requirement check (fails fast instead of 30-min compile)
- Replaced Homebrew with official Node.js .pkg installer
- Added sudo for npm permissions
- Added Windows-specific PowerShell helper with WSL2 auto-detection
- Updated all documentation and email templates to match verified flow

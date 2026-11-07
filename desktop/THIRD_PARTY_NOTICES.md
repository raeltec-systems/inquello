# Desktop presentation notices

## T3 Code — WorkLogDetails adaptation

`src/renderer/Shell/ConversationItems.tsx` adapts the live-edge scrolling helper from:
- Repository: https://github.com/pingdotgg/t3code
- Revision: `82b10d546c1041d8eff40425f076d61f608d518f`
- Path: `apps/web/src/components/chat/WorkLog.tsx`
- Source blob: `006e08f04f66b6ae4fdbaad823f5b662104e7122`

Changes: Inquello CSS classes replace Tailwind; native keyboard-accessible disclosures wrap authorized existing progress items. T3 runtime/state/RPC, permission defaults, assets and branding are not imported. Other transcript, sidebar and composer presentation is implemented against Inquello's existing typed bridges and the owner's visual references.

MIT License

Copyright (c) 2026 T3 Tools Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

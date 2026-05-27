# Agent Changelog

團隊 dev / QA 迴圈發現的問題與修正，寫在這裡供 agent 持續改進。

## 誰要寫

| 時機 | 負責 agent |
|------|------------|
| QA 發現 🔴 / 🟡 問題 | `qa-inspector` |
| fullstack-dev 修完 bug 或踩坑 | `fullstack-dev` |
| team-dev 迴圈結束 | 協調者整理一筆 summary |

## 格式

在 `CHANGELOG.md` **最上方**追加（新的在最上面）：

```markdown
## YYYY-MM-DD — 簡短標題

- **來源**：qa-inspector | fullstack-dev | team-dev
- **問題**：發生什麼
- **修正**：改了什麼
- **Agent 規則**：之後 agent 要遵守的一句話（會同步到 subagent）
```

## Subagent 同步

1. 每次 team-dev 結束，把「Agent 規則」合併進：
   - `~/.cursor/agents/fullstack-dev.md` 的 **Changelog 教訓** 區
   - `~/.cursor/agents/qa-inspector.md` 的 **Changelog 教訓** 區
2. 專案內 `.cursor/agents/*.md` 若有，一併更新（覆蓋 user 層同名 agent 時以專案為準）
3. 每日或每次重大 QA 後執行一次 sync（可由 `/team-dev` 自動觸發）

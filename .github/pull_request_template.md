## 变更说明

<!-- 这个 PR 做了什么，为什么需要它 -->

## 类型

- [ ] 新功能（feat）
- [ ] 缺陷修复（fix）
- [ ] 重构（refactor）
- [ ] 文档（docs）
- [ ] 测试（test）
- [ ] 构建 / CI（chore / ci）

## 影响范围

<!-- 涉及的模块：web / api / worker / infra / packages -->

## 验证方式

```bash
pnpm --filter @app/api exec tsc --noEmit
pnpm --filter @app/web exec tsc --noEmit
pnpm --filter @app/api test
cd services/worker && python3 -m pytest -q
```

- [ ] 上述命令本地通过
- [ ] 涉及 UI 时已附截图 / 录屏
- [ ] 新增文案已同时补充 en / zh

## 风险与回滚

<!-- 是否有数据库迁移、配置变更、破坏性接口变更？如何回滚？ -->

## 关联 Issue

Closes #

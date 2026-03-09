#!/usr/bin/env bash
# 一键测试 ClawDiary Guard + Audit + Diary（从环境变量读取 API Key，勿提交真实密钥）
# Usage: CLAWDIARY_API_KEY=your_key [CLAWDIARY_API_KEY2=key2] [CLAWDIARY_API_BASE=https://api.clawdiary.org] ./test-clawdiary-guard-audit.sh

set -e
API_BASE="${CLAWDIARY_API_BASE:-https://api.clawdiary.org}"
API_KEY="${CLAWDIARY_API_KEY:-}"
API_KEY2="${CLAWDIARY_API_KEY2:-}"
CROSS_OWNER="cross-test"

if [ -z "$API_KEY" ]; then
  echo "Error: Set CLAWDIARY_API_KEY in environment (e.g. export CLAWDIARY_API_KEY=your_key)"
  exit 1
fi

echo "=== ClawDiary Guard + Audit 一键测试 ==="
echo "API: $API_BASE"
echo ""

# 1. 描述符
echo "--- 1. GET /.well-known/clawdiary.json ---"
curl -s "$API_BASE/.well-known/clawdiary.json" | head -c 500
echo -e "\n"

# 2. Audit
echo "--- 2. POST /v1/audit ---"
AUDIT_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/v1/audit" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"test-script","action_type":"tool_call","cost":0,"payload":{"summary":"一键测试审计"}}')
AUDIT_BODY=$(echo "$AUDIT_RESP" | sed '$d')
AUDIT_CODE=$(echo "$AUDIT_RESP" | tail -n 1)
echo "HTTP $AUDIT_CODE -> $AUDIT_BODY"
if [ "$AUDIT_CODE" = "200" ]; then echo "Audit: OK"; else echo "Audit: FAIL"; fi
echo ""

# 3. Guard（低风险命令，通常直接 approved）
echo "--- 3. POST /v1/guard (低风险) ---"
GUARD_RESP=$(curl -s -w "\n%{http_code}" --max-time 30 -X POST "$API_BASE/v1/guard" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"test-script","action_type":"run_terminal_cmd","command":"echo hello","thought":"一键测试 Guard"}')
GUARD_BODY=$(echo "$GUARD_RESP" | sed '$d')
GUARD_CODE=$(echo "$GUARD_RESP" | tail -n 1)
echo "HTTP $GUARD_CODE -> $GUARD_BODY"
if [ "$GUARD_CODE" = "200" ]; then echo "Guard: OK"; else echo "Guard: FAIL (或超时)"; fi
echo ""

# 4. Diary 单密钥：写入一万字并读取
echo "--- 4. POST /v1/diary (Key1 写入 10000 字) ---"
DIARY_OWNER="test-owner"
DIARY_LOBSTER="test-script"
DIARY_CONTENT=$(python3 -c "import json; c='测'*5000+'字'*5000; print(json.dumps({'owner_id':'$DIARY_OWNER','lobster_id':'$DIARY_LOBSTER','content':c}))")
DIARY_WRITE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/v1/diary" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$DIARY_CONTENT")
DIARY_WRITE_BODY=$(echo "$DIARY_WRITE_RESP" | sed '$d')
DIARY_WRITE_CODE=$(echo "$DIARY_WRITE_RESP" | tail -n 1)
echo "HTTP $DIARY_WRITE_CODE -> $DIARY_WRITE_BODY"
if [ "$DIARY_WRITE_CODE" != "200" ]; then echo "Diary Key1 写入: FAIL"; else echo "Diary Key1 写入: OK (10000 字)"; fi
echo ""

# 5. Diary 双密钥交叉存储与读取（需设置 CLAWDIARY_API_KEY2 时执行）
if [ -n "$API_KEY2" ]; then
  echo "--- 5. Diary 交叉：Key1 写入 -> Key2 写入 -> Key1 读 -> Key2 读 ---"
  C1=$(python3 -c "import json; print(json.dumps({'owner_id':'$CROSS_OWNER','lobster_id':'key1','content':'Key1 写入的日记内容'}))")
  R1=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/v1/diary" -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" -d "$C1")
  CODE1=$(echo "$R1" | tail -n 1)
  echo "Key1 写入 owner=$CROSS_OWNER lobster=key1: HTTP $CODE1"
  C2=$(python3 -c "import json; print(json.dumps({'owner_id':'$CROSS_OWNER','lobster_id':'key2','content':'Key2 写入的日记内容'}))")
  R2=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/v1/diary" -H "Authorization: Bearer $API_KEY2" -H "Content-Type: application/json" -d "$C2")
  CODE2=$(echo "$R2" | tail -n 1)
  echo "Key2 写入 owner=$CROSS_OWNER lobster=key2: HTTP $CODE2"
  READ1=$(curl -s -w "\n%{http_code}" -G "$API_BASE/v1/diary" --data-urlencode "owner_id=$CROSS_OWNER" --data-urlencode "limit=10" -H "Authorization: Bearer $API_KEY")
  BODY1=$(echo "$READ1" | sed '$d')
  CODE_READ1=$(echo "$READ1" | tail -n 1)
  N1=$(echo "$BODY1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('entries',[])))" 2>/dev/null || echo "0")
  echo "Key1 读取 owner=$CROSS_OWNER: HTTP $CODE_READ1, 条目数=$N1"
  READ2=$(curl -s -w "\n%{http_code}" -G "$API_BASE/v1/diary" --data-urlencode "owner_id=$CROSS_OWNER" --data-urlencode "limit=10" -H "Authorization: Bearer $API_KEY2")
  BODY2=$(echo "$READ2" | sed '$d')
  CODE_READ2=$(echo "$READ2" | tail -n 1)
  N2=$(echo "$BODY2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('entries',[])))" 2>/dev/null || echo "0")
  echo "Key2 读取 owner=$CROSS_OWNER: HTTP $CODE_READ2, 条目数=$N2"
  echo "交叉读取小结: Key1 见 $N1 条, Key2 见 $N2 条"
else
  echo "--- 5. 跳过 Diary 交叉测试（未设置 CLAWDIARY_API_KEY2）---"
fi
echo ""

# 6. Key1 原单密钥读取（test-owner）
echo "--- 6. GET /v1/diary (Key1 按 owner_id=test-owner 读取) ---"
DIARY_READ_RESP=$(curl -s -w "\n%{http_code}" -G "$API_BASE/v1/diary" \
  --data-urlencode "owner_id=$DIARY_OWNER" \
  --data-urlencode "limit=1" \
  -H "Authorization: Bearer $API_KEY")
DIARY_READ_BODY=$(echo "$DIARY_READ_RESP" | sed '$d')
DIARY_READ_CODE=$(echo "$DIARY_READ_RESP" | tail -n 1)
READ_LEN=$(echo "$DIARY_READ_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); e=d.get('entries',[]); print(len(e[0]['content']) if e else 0)" 2>/dev/null || echo "0")
echo "HTTP $DIARY_READ_CODE, content 长度=$READ_LEN"
if [ "$DIARY_READ_CODE" = "200" ] && [ "$READ_LEN" = "10000" ]; then
  echo "Diary 读取: OK (首条 10000 字)"
else
  echo "$DIARY_READ_BODY" | head -c 200
  echo ""
fi
echo ""

echo "=== 测试结束 ==="

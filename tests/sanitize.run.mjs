
      import { sanitizeSvg } from '/src/sanitize.ts'
      import { vectors } from './sanitize-vectors.mjs'

      // 大小写不敏感的包含判断：用于抵御 JaVaScRiPt: 之类大小写混淆
      const contains = (haystack, needle) =>
        String(haystack).toLowerCase().includes(String(needle).toLowerCase())

      const rows = []
      const outputLines = []

      try {
        if (typeof sanitizeSvg !== 'function') throw new Error('sanitizeSvg 未正确导出')
        if (!Array.isArray(vectors)) throw new Error('vectors 不是数组')

        for (let i = 0; i < vectors.length; i += 1) {
          const v = vectors[i]
          const mustContain = Array.isArray(v.mustContain) ? v.mustContain : []
          const mustNotContain = Array.isArray(v.mustNotContain) ? v.mustNotContain : []
          const reasons = []
          let threw = false
          let out = ''
          let thrownMessage = ''

          try {
            out = sanitizeSvg(v.svg)
          } catch (err) {
            threw = true
            thrownMessage = err && err.message ? err.message : String(err)
          }

          if (v.expect === 'reject') {
            // 通过条件：抛错，或输出中不含任何 mustNotContain 敏感片段
            if (!threw) {
              const leaked = mustNotContain.filter((token) => contains(out, token))
              if (leaked.length) reasons.push('危险片段未被移除或拒绝：' + leaked.join('、'))
            }
          } else if (v.expect === 'accept') {
            // 通过条件：不抛错 + 含全部 mustContain + 不含任何 mustNotContain
            if (threw) {
              reasons.push('合法样本被拒绝（抛错）：' + thrownMessage)
            } else {
              const missing = mustContain.filter((token) => !contains(out, token))
              if (missing.length) reasons.push('缺少必要内容：' + missing.join('、'))
              const leaked = mustNotContain.filter((token) => contains(out, token))
              if (leaked.length) reasons.push('输出含禁止片段：' + leaked.join('、'))
            }
          } else {
            reasons.push('expect 值非法：' + String(v.expect))
          }

          rows.push({
            index: i + 1,
            name: String(v.name),
            expect: String(v.expect),
            ok: reasons.length === 0,
            reasons,
            note: threw ? 'sanitizeSvg 抛错（按拒绝处理）' : ''
          })
          outputLines.push(
            '[' + (i + 1) + '] ' + String(v.name) + '\n' +
            (threw ? '  (抛错，无输出)' : '  ' + String(out).slice(0, 300))
          )
        }
      } catch (err) {
        rows.push({
          index: rows.length + 1,
          name: '执行异常',
          expect: '-',
          ok: false,
          reasons: [err && err.message ? err.message : String(err)],
          note: ''
        })
      }

      const passed = rows.filter((r) => r.ok).length
      const failed = rows.length - passed
      const failures = rows
        .filter((r) => !r.ok)
        .map((r) => ({ name: r.name, expect: r.expect, reasons: r.reasons }))

      const result = { total: rows.length, passed, failed, ok: failed === 0, failures }
      window.__SANITIZE_TEST_RESULT__ = result

      // ---------- 渲染（全部用 textContent，避免把不可信字符串当 HTML 解析） ----------
      const summary = document.getElementById('summary')
      summary.textContent = failed === 0
        ? '全部通过：共 ' + result.total + ' 条 · 通过 ' + passed + ' · 失败 ' + failed
        : '存在失败：共 ' + result.total + ' 条 · 通过 ' + passed + ' · 失败 ' + failed
      summary.setAttribute('data-state', failed === 0 ? 'pass' : 'fail')

      const tbody = document.getElementById('rows')
      const frag = document.createDocumentFragment()
      for (const r of rows) {
        const tr = document.createElement('tr')
        tr.className = r.ok ? 'pass' : 'fail'
        const cells = [
          ['idx', String(r.index)],
          ['name', r.name],
          ['expect', r.expect],
          ['state', r.ok ? '通过' : '失败'],
          ['reason', r.reasons.length ? r.reasons.join('；') : (r.note || '符合预期')]
        ]
        for (const [cls, text] of cells) {
          const td = document.createElement('td')
          td.className = cls
          td.textContent = text
          tr.appendChild(td)
        }
        frag.appendChild(tr)
      }
      tbody.appendChild(frag)

      document.getElementById('machine').textContent = JSON.stringify(result, null, 2)
      document.getElementById('outputs').textContent = outputLines.join('\n\n')
    
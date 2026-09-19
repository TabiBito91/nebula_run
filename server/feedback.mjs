const text = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v)
export function validateFeedback(b) {
  if (Object.keys(b).some(k => !['id','category','message','feeling','context'].includes(k))) return null
  if (typeof b.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(b.id)) return null
  if (!['bug','difficulty','suggestion','other'].includes(b.category) || !['','easy','right','hard'].includes(b.feeling)) return null
  if (typeof b.message !== 'string' || !b.message.trim() || b.message.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(b.message)) return null
  const c = b.context
  if (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).sort().join() !== ['schema','build','levelId','levelName','difficulty','rules','screen','phase','elapsed','controls'].sort().join()) return null
  if (c.schema !== 1 || !text(c.build,80) || !text(c.levelId,80) || !text(c.levelName,100) || !text(c.rules,80)
    || !['relaxed','standard','veteran'].includes(c.difficulty) || !['title','pause','victory','defeat'].includes(c.screen)
    || !['touch','keyboard'].includes(c.controls) || !(c.phase === null || text(c.phase,80))
    || !(c.elapsed === null || Number.isFinite(c.elapsed) && c.elapsed >= 0 && c.elapsed <= 86400)) return null
  return { id:b.id, category:b.category, message:b.message.trim(), feeling:b.feeling,
    context:Object.fromEntries(Object.entries(c).sort(([a],[b])=>a.localeCompare(b))) }
}

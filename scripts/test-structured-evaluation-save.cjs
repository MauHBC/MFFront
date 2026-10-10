const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  // Replace only the default transport; exercises the actual module with injected client.
  const source = fs.readFileSync(path.join(__dirname, '../src/services/structuredEvaluationSave.js'), 'utf8')
    .replace('import api from "./axios";', 'const api = {};');
  const { createStructuredEvaluationSaveAttempt, structuredEvaluationSaveMessage, normalizeStructuredEvaluationAnswers } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  );
  const payload = { evaluation: { patient_id: 1 }, forms: [{ form_template_id: 10, answers: [] }] };
  const calls = [];
  let failSave = true;
  let failSign = true;
  const client = { post: async (url, body, config) => {
    calls.push({ url, body, config });
    if (url === '/evaluations/structured') {
      if (failSave) { failSave = false; throw new Error('Fictional timeout'); }
      return { data: { id: 123, version: 1, clinical_state: 'draft' } };
    }
    if (failSign) { failSign = false; throw new Error('Fictional signature timeout'); }
    return { data: { id: 123, version: 2, clinical_state: 'finalized' } };
  } };
  const attempt = createStructuredEvaluationSaveAttempt({ key: 'fictional-0001', client });
  const first = attempt.save(payload);
  assert.equal(first, attempt.save(payload));
  await assert.rejects(first, /Fictional timeout/);
  await assert.rejects(attempt.save({ ...payload, evaluation: { patient_id: 2 } }), /IDEMPOTENCY_CONFLICT/);
  await assert.rejects(attempt.save({ ...payload, shouldSign: true }), (error) => {
    assert.equal(error.savedRecord.id, 123);
    assert(structuredEvaluationSaveMessage(error).includes('rascunho'));
    return true;
  });
  const result = await attempt.save({ ...payload, shouldSign: true });
  assert.equal(result.finalized.clinical_state, 'finalized');
  assert.equal(calls.filter(({ url }) => url === '/evaluations/structured').length, 2);
  assert.equal(calls[0].body.idempotency_key, calls[1].body.idempotency_key);
  assert.equal(calls[2].config.headers['Idempotency-Key'], calls[3].config.headers['Idempotency-Key']);
  assert.equal(attempt.getSavedRecord().id, 123);
  assert.deepEqual(normalizeStructuredEvaluationAnswers([{ form_question_id: '20', option_id: '30' }]), [{ form_question_id: 20, option_id: 30 }]);
  let updateCalls = 0;
  const updateAttempt = createStructuredEvaluationSaveAttempt({ key: 'fictional-edit-01', recordId: 123, client: {
    put: async (url, requestBody) => {
      updateCalls += 1;
      assert.equal(url, '/evaluations/123/structured');
      assert.equal(requestBody.version, 1);
      return { data: { id: 123, version: 2, clinical_state: 'draft' } };
    },
  } });
  await updateAttempt.save({ ...payload, version: 1 });
  await updateAttempt.save({ ...payload, version: 1 });
  assert.equal(updateCalls, 1);
  const invalidResponse = createStructuredEvaluationSaveAttempt({ key: 'fictional-invalid', client: { post: async () => ({ data: { id: 0 } }) } });
  await assert.rejects(invalidResponse.save(payload), /INVALID_CLINICAL_RECORD_SAVE_RESPONSE/);
  const invalidFinalization = createStructuredEvaluationSaveAttempt({ key: 'fictional-invalid-sign', client: { post: async () => ({ data: { id: 123, version: 1, clinical_state: 'draft' } }) } });
  await assert.rejects(invalidFinalization.save({ ...payload, shouldSign: true }), /INVALID_CLINICAL_RECORD_FINALIZATION_RESPONSE/);
  process.stdout.write('PASS double click, timeout retry, changed payload, recoverable draft, signature retry\n');
})().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });

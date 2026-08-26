import fs from 'fs';
import path from 'path';
import {
  buildPlanChangePreviewPresentation,
  buildPlanCommercialDisplay,
} from './planChangePresentation';

describe('buildPlanCommercialDisplay', () => {
  it('não mantém estado financeiro na tela de Planos', () => {
    const planosSource = fs.readFileSync(
      path.join(__dirname, '../pages/Planos/index.js'),
      'utf8',
    );

    expect(planosSource).not.toMatch(/Sem cobrança gerada/i);
    expect(planosSource).not.toMatch(/billing_status|financial_status|Mensalidade vencida/i);
    expect(planosSource).not.toMatch(/health_summary/i);
  });

  it('preserva visualmente as quebras de linha das observações', () => {
    const detailSource = fs.readFileSync(
      path.join(__dirname, '../pages/Planos/PatientPlanDetailView.js'),
      'utf8',
    );

    expect(detailSource).toMatch(/<NotesDisclosure>[\s\S]*<p>\{notes\}<\/p>/);
    expect(detailSource).toMatch(/const NotesDisclosure = styled\.details`[\s\S]*white-space: pre-wrap;/);
  });

  it('mantém o plano vigente separado da troca futura', () => {
    const result = buildPlanCommercialDisplay({
      currentPlanName: 'Funcional 3x/semana',
      pendingChange: {
        service_plan_name: 'Funcional 2x/semana',
        effective_on: '2026-07-13',
        lifecycle_state: 'future_editable',
        previous_schedule: [
          { weekday: 1, time: '07:00' },
          { weekday: 3, time: '07:00' },
          { weekday: 5, time: '07:00' },
        ],
        new_schedule: [
          { weekday: 3, time: '07:00' },
          { weekday: 5, time: '07:00' },
        ],
      },
    });

    expect(result.current_plan_name).toBe('Funcional 3x/semana');
    expect(result.pending_plan_name).toBe('Funcional 2x/semana');
    expect(result.pending_effective_label).toBe('13/07/2026');
    expect(result.current_schedule_text).toBe('Seg 07:00 · Qua 07:00 · Sex 07:00');
    expect(result.pending_schedule_text).toBe('Qua 07:00 · Sex 07:00');
    expect(result.action_label).toBe('Editar troca agendada');
    expect(result.show_create_action).toBe(false);
    expect(result.show_edit_action).toBe(true);
    expect(result.show_cancel_action).toBe(true);
  });

  it('não inventa plano futuro quando não existe pendência', () => {
    const result = buildPlanCommercialDisplay({
      currentPlanName: 'Funcional 3x/semana',
      pendingChange: null,
    });
    expect(result.has_pending_change).toBe(false);
    expect(result.pending_plan_name).toBeNull();
    expect(result.action_label).toBe('Trocar plano');
    expect(result.show_create_action).toBe(true);
    expect(result.show_edit_action).toBe(false);
    expect(result.show_cancel_action).toBe(false);
  });

  it('não oferece uma segunda troca comum enquanto existe pendência', () => {
    const result = buildPlanCommercialDisplay({
      currentPlanName: 'Funcional 3x/semana',
      pendingChange: { effective_on: '2026-08-13', lifecycle_state: 'future_editable' },
    });
    expect(result.show_create_action).toBe(false);
    expect(result.action_label).toBe('Editar troca agendada');
  });

  it('não oferece edição para pendência vencida aguardando lifecycle', () => {
    const result = buildPlanCommercialDisplay({
      currentPlanName: 'Funcional 3x/semana',
      pendingChange: {
        effective_on: '2026-08-13',
        lifecycle_state: 'overdue_awaiting_lifecycle',
      },
    });
    expect(result.show_create_action).toBe(false);
    expect(result.show_edit_action).toBe(false);
    expect(result.show_cancel_action).toBe(false);
  });
});

describe('buildPlanChangePreviewPresentation', () => {
  it('exibe o período completo do próximo ciclo calculado pelo backend', () => {
    const result = buildPlanChangePreviewPresentation({
      status: 'success',
      preview: {
        effective_mode: 'next_cycle',
        current_cycle_start: '2026-07-18',
        current_plan_ends_on: '2026-08-17',
        next_cycle_start: '2026-08-18',
        next_cycle_end: '2026-09-17',
        effective_on: '2026-08-18',
        schedule_effective_from: '2026-08-18',
        preserved_sessions_through: '2026-08-17',
        preview_token: 'token-sintetico',
      },
    });

    expect(result.ready).toBe(true);
    expect(result.effective_label).toBe('18/08');
    expect(result.current_ends_label).toBe('17/08');
    expect(result.period_label).toBe('18/08 a 17/09');
    expect(result.confirmation_text).toBe(
      'Atendimentos até 17/08 não serão alterados.',
    );
    expect(result.status_text).toContain(
      'A alteração será aplicada ao próximo ciclo, de 18/08 a 17/09.',
    );
  });

  it.each([
    ['loading', '', 'Carregando períodos...'],
    ['error', 'Falha sintética', 'Falha sintética'],
  ])('mantém confirmação bloqueada no estado %s', (status, error, expectedText) => {
    const result = buildPlanChangePreviewPresentation({ status, preview: null, error });
    expect(result.ready).toBe(false);
    expect(result.status_text).toBe(expectedText);
    expect(result.confirmation_text).toBeNull();
  });

  it('sinaliza atualização quando preserva uma prévia válida durante o loading', () => {
    const result = buildPlanChangePreviewPresentation({
      status: 'loading',
      preview: { next_cycle_start: '2026-09-25' },
      error: '',
    });

    expect(result.ready).toBe(false);
    expect(result.status_text).toBe('Atualizando...');
  });

  it('recalcula a apresentação quando a prévia muda', () => {
    const first = buildPlanChangePreviewPresentation({
      status: 'success',
      preview: {
        effective_mode: 'next_cycle',
        current_cycle_start: '2026-07-18',
        current_cycle_end: '2026-08-17',
        next_cycle_start: '2026-08-18',
        next_cycle_end: '2026-09-17',
        effective_on: '2026-08-18',
        current_plan_ends_on: '2026-08-17',
        schedule_effective_from: '2026-08-18',
        preserved_sessions_through: '2026-08-17',
        preview_token: 'primeiro',
      },
    });
    const second = buildPlanChangePreviewPresentation({
      status: 'success',
      preview: {
        effective_mode: 'next_cycle',
        current_cycle_start: '2026-08-18',
        current_cycle_end: '2026-09-17',
        next_cycle_start: '2026-09-18',
        next_cycle_end: '2026-10-17',
        effective_on: '2026-09-18',
        current_plan_ends_on: '2026-09-17',
        schedule_effective_from: '2026-09-18',
        preserved_sessions_through: '2026-09-17',
        preview_token: 'segundo',
      },
    });

    expect(first.effective_label).toBe('18/08');
    expect(second.effective_label).toBe('18/09');
  });

  it('separa vigência comercial, nova Agenda e preservação no ciclo atual', () => {
    const result = buildPlanChangePreviewPresentation({
      status: 'success',
      preview: {
        effective_mode: 'current_cycle',
        current_cycle_start: '2026-08-14',
        current_cycle_end: '2026-09-13',
        commercial_effective_on: '2026-08-14',
        schedule_effective_from: '2026-08-27',
        preserved_sessions_through: '2026-08-26',
        can_confirm: true,
        preview_token: 'current-cycle-token',
        current_cycle_financial_impact: {
          current_amount_cents: 60000,
          new_amount_cents: 48000,
        },
      },
    });

    expect(result.ready).toBe(true);
    expect(result.effective_label).toBe('14/08');
    expect(result.schedule_effective_label).toBe('27/08');
    expect(result.period_label).toBe('14/08 a 13/09');
    expect(result.status_text).toBe(
      'A alteração será aplicada ao ciclo atual, de 14/08 a 13/09.\nA nova agenda começa em 27/08.\nOs atendimentos até 26/08 permanecem como estão.',
    );
    expect(result.confirmation_text).toBe(
      'Atendimentos até 26/08 não serão alterados.',
    );
    expect(result.status_text).not.toMatch(/Vigência comercial/i);
  });

  it('mantém confirmação bloqueada com o motivo funcional do ciclo atual', () => {
    const result = buildPlanChangePreviewPresentation({
      status: 'success',
      preview: {
        effective_mode: 'current_cycle',
        current_cycle_start: '2026-08-14',
        current_cycle_end: '2026-09-13',
        commercial_effective_on: '2026-08-14',
        schedule_effective_from: '2026-08-27',
        can_confirm: false,
        preview_token: 'blocked-token',
        current_cycle_eligibility: {
          eligible: false,
          message: 'Este ciclo já possui pagamento ou movimentação financeira.',
        },
      },
    });

    expect(result.ready).toBe(false);
    expect(result.status_text).toBe(
      'Este ciclo já possui pagamento ou movimentação financeira.',
    );
  });
});

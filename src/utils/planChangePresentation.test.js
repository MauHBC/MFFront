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
    const planosSource = fs.readFileSync(
      path.join(__dirname, '../pages/Planos/index.js'),
      'utf8',
    );

    expect(planosSource).toMatch(/<PlanNotesValue>\{ppDetailPlanNotes\}<\/PlanNotesValue>/);
    expect(planosSource).toMatch(/const PlanNotesValue = styled\.strong`[\s\S]*white-space: pre-line;/);
  });

  it('mantém o plano vigente separado da troca futura', () => {
    const result = buildPlanCommercialDisplay({
      currentPlanName: 'Funcional 3x/semana',
      pendingChange: {
        service_plan_name: 'Funcional 2x/semana',
        effective_on: '2026-07-13',
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
      pendingChange: { effective_on: '2026-08-13' },
    });
    expect(result.show_create_action).toBe(false);
    expect(result.action_label).toBe('Editar troca agendada');
  });
});

describe('buildPlanChangePreviewPresentation', () => {
  it('exibe as datas exatas calculadas pelo backend', () => {
    const result = buildPlanChangePreviewPresentation({
      status: 'success',
      preview: {
        effective_on: '2026-08-18',
        current_plan_ends_on: '2026-08-17',
        preview_token: 'token-sintetico',
      },
    });

    expect(result.ready).toBe(true);
    expect(result.effective_label).toBe('18/08/2026');
    expect(result.current_ends_label).toBe('17/08/2026');
    expect(result.confirmation_text).toBe(
      'Plano atual segue até 17/08/2026.',
    );
    expect(result.confirmation_text).not.toMatch(/novo plano começa|passam a valer/i);
    expect(result.confirmation_text).not.toMatch(/backend|próximo ciclo/i);
  });

  it.each([
    ['loading', '', 'Calculando a vigência...'],
    ['error', 'Falha sintética', 'Falha sintética'],
  ])('mantém confirmação bloqueada no estado %s', (status, error, expectedText) => {
    const result = buildPlanChangePreviewPresentation({ status, preview: null, error });
    expect(result.ready).toBe(false);
    expect(result.status_text).toBe(expectedText);
    expect(result.confirmation_text).toBeNull();
  });

  it('recalcula a apresentação quando a prévia muda', () => {
    const first = buildPlanChangePreviewPresentation({
      status: 'success',
      preview: {
        effective_on: '2026-08-18',
        current_plan_ends_on: '2026-08-17',
        preview_token: 'primeiro',
      },
    });
    const second = buildPlanChangePreviewPresentation({
      status: 'success',
      preview: {
        effective_on: '2026-09-18',
        current_plan_ends_on: '2026-09-17',
        preview_token: 'segundo',
      },
    });

    expect(first.effective_label).toBe('18/08/2026');
    expect(second.effective_label).toBe('18/09/2026');
  });
});

import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

const getStyledBlock = (name) => {
  const start = source.indexOf(`const ${name} = styled`);
  const end = source.indexOf('`;', start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return source.slice(start, end + 2);
};

describe('Financeiro - badge de despesas da clínica', () => {
  it('reserva espaço superior no scroll horizontal para o badge sobreposto', () => {
    const navigation = getStyledBlock('FinanceSectionNavigation');
    const badge = getStyledBlock('SidebarAlertBadge');

    expect(navigation).toContain('overflow-x: auto;');
    expect(navigation).toContain('padding-top: 7px;');
    expect(badge).toContain('position: absolute;');
    expect(badge).toContain('top: -6px;');
    expect(badge).toContain('right: -6px;');
    expect(badge).toContain('height: 22px;');
    expect(badge).toContain('background: #c63b32;');
    expect(badge).toContain('border-radius: 999px;');
    expect(badge).toContain('display: inline-flex;');
    expect(badge).toContain('flex-shrink: 0;');
  });

  it('mantém o badge associado à aba Despesas da clínica', () => {
    const expenseButtonStart = source.indexOf(
      'onClick={() => handleSectionChange("clinic-expenses")}'
    );
    const expenseButtonEnd = source.indexOf(
      '</FinanceSectionButton>',
      expenseButtonStart
    );
    const expenseButton = source.slice(expenseButtonStart, expenseButtonEnd);

    expect(expenseButtonStart).toBeGreaterThanOrEqual(0);
    expect(expenseButtonEnd).toBeGreaterThan(expenseButtonStart);
    expect(expenseButton).toContain('Despesas da clínica');
    expect(expenseButton).toContain(
      '<SidebarAlertBadge>{clinicExpenseAlertsBadge}</SidebarAlertBadge>'
    );
  });

  it('mantém o badge fora do fluxo sem alterar as dimensões da aba', () => {
    const button = getStyledBlock('FinanceSectionButton');
    const badge = getStyledBlock('SidebarAlertBadge');

    expect(button).toContain('position: relative;');
    expect(button).toContain('min-height: 44px;');
    expect(button).toContain('flex: 0 0 auto;');
    expect(badge).toContain('position: absolute;');
    expect(badge).not.toMatch(/\bmargin\s*:/);
  });
});

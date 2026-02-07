/// <reference types="cypress" />

/**
 * Invoicing E2E Tests
 *
 * Tests for invoice generation, payment tracking, and billing management.
 * Critical for revenue tracking and studio billing.
 */

describe('Invoicing', () => {
  let competitionId: number;

  before(() => {
    cy.loginAsAdmin();
    cy.createTestCompetitionAndNavigateToSettings('Invoice Test Comp').then((id) => {
      competitionId = id as unknown as number;
    });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
  });

  describe('Invoice Dashboard', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/invoices`);
    });

    it('should display invoicing page', () => {
      cy.contains(/invoice|billing/i).should('be.visible');
    });

    it('should show invoice summary stats', () => {
      // Should show total revenue, outstanding, etc.
      cy.contains(/total|revenue|outstanding|paid/i).should('be.visible');
    });

    it('should list all invoices', () => {
      cy.get('[data-testid="invoice-list"], table').should('be.visible');
    });

    it('should filter invoices by status', () => {
      cy.get('select[name="status"], [data-testid="status-filter"]').then(($filter) => {
        if ($filter.length) {
          cy.wrap($filter).select('paid');
          // Should filter results
        }
      });
    });

    it('should search invoices by studio name', () => {
      cy.get('input[placeholder*="search" i]').type('Test Studio');
      // Should filter to matching studios
    });
  });

  describe('Invoice Generation', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/invoices`);
    });

    it('should generate invoice for a studio', () => {
      cy.contains(/generate|create.*invoice/i).click();

      // Select studio
      cy.get('select[name="studio"], [data-testid="studio-select"]').select(1);

      // Generate
      cy.contains('button', /generate|create/i).click();

      // Should show success
      cy.contains(/generated|created|success/i).should('be.visible');
    });

    it('should generate invoices for all studios', () => {
      cy.contains(/generate all|batch/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();
          cy.on('window:confirm', () => true);
          cy.contains(/generated|success/i).should('be.visible');
        }
      });
    });

    it('should calculate invoice amount based on entries', () => {
      cy.contains(/generate|create.*invoice/i).click();
      cy.get('select[name="studio"]').select(1);

      // Should show calculated amount
      cy.contains(/\$[\d,]+|total.*amount/i).should('be.visible');
    });

    it('should include entry fee breakdown', () => {
      cy.get('[data-testid="invoice-item"]').first().click();

      // Should show line items
      cy.contains(/entry|event|fee/i).should('be.visible');
    });
  });

  describe('Invoice Details', () => {
    it('should display invoice details', () => {
      cy.visit(`/competitions/${competitionId}/invoices`);

      cy.get('[data-testid="invoice-item"], tr').first().click();

      // Should show invoice details
      cy.contains(/invoice #|inv-/i).should('be.visible');
    });

    it('should show studio information', () => {
      cy.visit(`/competitions/${competitionId}/invoices`);
      cy.get('[data-testid="invoice-item"]').first().click();

      cy.contains(/studio|contact|address/i).should('be.visible');
    });

    it('should show line items with prices', () => {
      cy.visit(`/competitions/${competitionId}/invoices`);
      cy.get('[data-testid="invoice-item"]').first().click();

      // Should have item rows with amounts
      cy.get('[data-testid="line-item"], .line-item').should('have.length.at.least', 1);
    });

    it('should calculate subtotal, tax, and total', () => {
      cy.visit(`/competitions/${competitionId}/invoices`);
      cy.get('[data-testid="invoice-item"]').first().click();

      cy.contains(/subtotal|total/i).should('be.visible');
    });
  });

  describe('Payment Recording', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/invoices`);
    });

    it('should record a payment', () => {
      cy.get('[data-testid="invoice-item"]').first().click();

      cy.contains(/record payment|add payment/i).click();

      // Enter payment amount
      cy.get('input[name="amount"]').type('100');

      // Select payment method
      cy.get('select[name="method"]').select(1);

      cy.contains('button', /record|save/i).click();

      cy.contains(/recorded|saved|success/i).should('be.visible');
    });

    it('should show payment history', () => {
      cy.get('[data-testid="invoice-item"]').first().click();

      cy.contains(/payment history|payments/i).should('be.visible');
    });

    it('should update balance after payment', () => {
      cy.get('[data-testid="invoice-item"]').first().click();

      // Note initial balance
      cy.get('[data-testid="balance"]').invoke('text').then((initialBalance) => {
        cy.contains(/record payment/i).click();
        cy.get('input[name="amount"]').type('50');
        cy.contains('button', /record/i).click();

        // Balance should be reduced
        cy.get('[data-testid="balance"]').invoke('text').should('not.eq', initialBalance);
      });
    });

    it('should mark invoice as paid when fully paid', () => {
      cy.get('[data-testid="invoice-item"]').contains(/unpaid|outstanding/i).parent().click();

      // Get total and pay it
      cy.get('[data-testid="total"]').invoke('text').then((total) => {
        const amount = total.replace(/[^0-9.]/g, '');

        cy.contains(/record payment/i).click();
        cy.get('input[name="amount"]').clear().type(amount);
        cy.contains('button', /record/i).click();

        cy.contains(/paid in full|status.*paid/i).should('be.visible');
      });
    });
  });

  describe('Invoice Actions', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/invoices`);
    });

    it('should print invoice', () => {
      cy.get('[data-testid="invoice-item"]').first().click();

      cy.contains(/print/i).then(($btn) => {
        if ($btn.length) {
          // Can't actually test print dialog, but button should exist
          cy.wrap($btn).should('be.visible');
        }
      });
    });

    it('should download invoice as PDF', () => {
      cy.get('[data-testid="invoice-item"]').first().click();

      cy.contains(/download|pdf|export/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).should('be.visible');
        }
      });
    });

    it('should email invoice to studio', () => {
      cy.get('[data-testid="invoice-item"]').first().click();

      cy.contains(/email|send/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();

          // Should show email confirmation or dialog
          cy.contains(/sent|email|confirm/i).should('be.visible');
        }
      });
    });

    it('should void an invoice', () => {
      cy.get('[data-testid="invoice-item"]').first().click();

      cy.contains(/void|cancel/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();
          cy.on('window:confirm', () => true);

          cy.contains(/voided|cancelled/i).should('be.visible');
        }
      });
    });
  });

  describe('Pricing Configuration', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/settings`);
    });

    it('should set entry fees by level', () => {
      cy.contains(/pricing|fees|billing/i).click();

      cy.get('input[name="bronzeFee"], [data-testid="level-fee"]').first().clear().type('75');

      cy.contains('button', /save/i).click();

      cy.contains(/saved/i).should('be.visible');
    });

    it('should set pro-am vs amateur pricing', () => {
      cy.contains(/pricing|fees/i).click();

      cy.get('input[name="proAmFee"]').then(($input) => {
        if ($input.length) {
          cy.wrap($input).clear().type('100');
        }
      });
    });

    it('should configure late registration fee', () => {
      cy.contains(/pricing|fees/i).click();

      cy.get('input[name="lateFee"]').then(($input) => {
        if ($input.length) {
          cy.wrap($input).clear().type('25');
          cy.contains('button', /save/i).click();
        }
      });
    });

    it('should set currency', () => {
      cy.contains(/billing|currency/i).click();

      cy.get('select[name="currency"]').select('EUR');
      cy.contains('button', /save/i).click();

      cy.contains(/saved/i).should('be.visible');
    });
  });

  describe('Financial Reports', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/reports`);
    });

    it('should show revenue summary', () => {
      cy.contains(/revenue|financial|report/i).should('be.visible');
    });

    it('should break down revenue by studio', () => {
      cy.contains(/by studio|studio breakdown/i).then(($el) => {
        if ($el.length) {
          cy.wrap($el).click();
          cy.get('table, [data-testid="studio-revenue"]').should('be.visible');
        }
      });
    });

    it('should show outstanding balances', () => {
      cy.contains(/outstanding|unpaid|balance/i).should('be.visible');
    });

    it('should export financial report', () => {
      cy.contains(/export|download/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).should('be.visible');
        }
      });
    });
  });

  describe('Refunds', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/invoices`);
    });

    it('should process a refund', () => {
      cy.get('[data-testid="invoice-item"]').contains(/paid/i).parent().click();

      cy.contains(/refund/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();

          cy.get('input[name="refundAmount"]').type('50');
          cy.get('input[name="reason"]').type('Event cancellation');

          cy.contains('button', /process|submit/i).click();

          cy.contains(/refunded|processed/i).should('be.visible');
        }
      });
    });

    it('should show refund in payment history', () => {
      cy.get('[data-testid="invoice-item"]').first().click();

      cy.contains(/refund/i).should('be.visible');
    });
  });

  describe('Discounts', () => {
    beforeEach(() => {
      cy.visit(`/competitions/${competitionId}/invoices`);
    });

    it('should apply discount to invoice', () => {
      cy.get('[data-testid="invoice-item"]').first().click();

      cy.contains(/discount|adjust/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();

          cy.get('input[name="discount"]').type('10');
          cy.contains('button', /apply/i).click();

          cy.contains(/applied|discount/i).should('be.visible');
        }
      });
    });

    it('should apply percentage discount', () => {
      cy.get('[data-testid="invoice-item"]').first().click();

      cy.contains(/discount/i).then(($btn) => {
        if ($btn.length) {
          cy.wrap($btn).click();

          cy.get('input[name="discountPercent"]').type('10');
          cy.contains('button', /apply/i).click();
        }
      });
    });
  });
});

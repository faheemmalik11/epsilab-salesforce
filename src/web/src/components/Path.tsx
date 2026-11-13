import { useState } from 'react';
import { ButtonIcon } from './Icon';

export interface PathStep {
  value: string;
  label: string;
}

interface PathProps {
  steps: PathStep[];
  /** Index of the record's current step, or -1 when its value is not on the path. */
  currentIndex: number;
  currentText: string;
  /** Button label and action for the selected step. */
  action(selectedIndex: number): { label: string; run(): void } | null;
  busy?: boolean;
}

/** SLDS Path: completed, current and upcoming steps, with one action for the selected step. */
export function Path({ steps, currentIndex, currentText, action, busy }: PathProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const selectedIndex = selected ?? currentIndex;
  const act = selectedIndex >= 0 ? action(selectedIndex) : null;

  return (
    <div className="slds-path slds-m-bottom_small" data-testid="path">
      <div className="slds-grid slds-path__track">
        <div className="slds-grid slds-path__scroller-container">
          <div className="slds-path__scroller">
            <div className="slds-path__scroller_inner">
              <ul className="slds-path__nav" role="listbox" aria-orientation="horizontal">
                {steps.map((step, index) => {
                  const state =
                    index < currentIndex ? 'slds-is-complete' : index === currentIndex ? 'slds-is-current' : 'slds-is-incomplete';
                  return (
                    <li
                      key={step.value}
                      role="presentation"
                      className={`slds-path__item ${state} ${index === selectedIndex ? 'slds-is-active' : ''}`}
                    >
                      <a
                        aria-selected={index === selectedIndex}
                        className="slds-path__link"
                        href="#"
                        role="option"
                        tabIndex={index === selectedIndex ? 0 : -1}
                        data-testid={`path-step-${step.value}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setSelected(index);
                        }}
                      >
                        <span className="slds-path__stage">
                          <ButtonIcon name="check" />
                        </span>
                        <span className="slds-path__title">{step.label}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
        <div className="slds-grid slds-path__action">
          <span className="slds-path__stage-name">{currentText}</span>
          <button
            type="button"
            className="slds-button slds-button_brand slds-path__mark-complete"
            disabled={!act || busy}
            data-testid="path-action"
            onClick={() => {
              act?.run();
              setSelected(null);
            }}
          >
            <ButtonIcon name="check" position="left" />
            {act?.label ?? 'Select a step'}
          </button>
        </div>
      </div>
    </div>
  );
}

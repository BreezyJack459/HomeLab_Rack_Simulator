import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

export type ModelInspectorTab = 'properties' | 'cables' | 'ports';

type ModelInspectorSelectionKind = 'device' | 'cable';

interface ModelInspectorTabsProps {
  selectionKind: ModelInspectorSelectionKind;
  selectionKey: string;
  properties: ReactNode;
  cables: ReactNode;
  ports: ReactNode;
}

const TAB_DEFINITIONS: Array<{
  id: ModelInspectorTab;
  label: string;
  emptyMessage: string;
}> = [
  {
    id: 'properties',
    label: 'Properties',
    emptyMessage: 'No properties are available for this selection.',
  },
  {
    id: 'cables',
    label: 'Cables',
    emptyMessage: 'Cable planning is not available in this view.',
  },
  {
    id: 'ports',
    label: 'Ports',
    emptyMessage: 'No port controls are available for this selection.',
  },
];

function defaultTabForSelection(
  selectionKind: ModelInspectorSelectionKind,
): ModelInspectorTab {
  return selectionKind === 'cable' ? 'cables' : 'properties';
}

export function ModelInspectorTabs({
  selectionKind,
  selectionKey,
  properties,
  cables,
  ports,
}: ModelInspectorTabsProps) {
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<ModelInspectorTab>(() =>
    defaultTabForSelection(selectionKind),
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setActiveTab(defaultTabForSelection(selectionKind));
  }, [selectionKey, selectionKind]);

  const panelContent: Record<ModelInspectorTab, ReactNode> = {
    properties,
    cables,
    ports,
  };

  function activateTab(index: number) {
    const tab = TAB_DEFINITIONS[index];
    if (!tab) return;
    setActiveTab(tab.id);
    tabRefs.current[index]?.focus();
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % TAB_DEFINITIONS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex =
        (currentIndex - 1 + TAB_DEFINITIONS.length) % TAB_DEFINITIONS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = TAB_DEFINITIONS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    activateTab(nextIndex);
  }

  return (
    <section aria-label="Selection details">
      <div
        role="tablist"
        aria-label="Selection details"
        className="grid grid-cols-3 gap-1 rounded-xl border border-edge bg-fill/70 p-1 dark:border-edge dark:bg-fill/60"
      >
        {TAB_DEFINITIONS.map((tab, index) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`${baseId}-${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-${tab.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`rounded-lg px-2 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 ${
                selected
                  ? 'bg-surface text-content shadow-sm dark:bg-surface-raised dark:text-content'
                  : 'text-content-muted hover:bg-surface/65 hover:text-content dark:text-content-muted dark:hover:bg-surface/55'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {TAB_DEFINITIONS.map((tab) => {
        const content = panelContent[tab.id];
        return (
          <div
            key={tab.id}
            id={`${baseId}-${tab.id}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-${tab.id}-tab`}
            tabIndex={0}
            hidden={activeTab !== tab.id}
            className="mt-3 space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
          >
            {content ?? (
              <div className="rounded-2xl border border-dashed border-edge-strong bg-surface/60 p-4 text-sm text-content-muted dark:border-edge-strong dark:bg-surface/60 dark:text-content-muted">
                {tab.emptyMessage}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

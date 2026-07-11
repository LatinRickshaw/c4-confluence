import React, { useEffect, useState } from 'react';
import { view } from '@forge/bridge';
import App from './App';
import { ConfigScreen } from './components/ConfigScreen';
import { ModelExplorer } from './components/ModelExplorer';

type Mode = 'loading' | 'macroConfig' | 'macro' | 'spacePage';

/**
 * The macro, its config screen, and the space page all share this same built
 * bundle to avoid separate CRA entry points per Forge module/resource -
 * Forge just loads it into a different iframe slot for each.
 *
 * extension.type === 'macro' is the confirmed-reliable signal that this
 * render is a macro placement (body or config) at all - checked first.
 * Within that, extension.macro.isConfiguring distinguishes the config
 * screen from the macro body. Anything else (no `type: 'macro'`) is the
 * space page - it isn't a macro placement and carries no `content`/`macro`
 * context at all.
 */
export default function Root() {
  const [mode, setMode] = useState<Mode>('loading');

  useEffect(() => {
    view.getContext().then((context) => {
      if (context.extension?.type !== 'macro') {
        setMode('spacePage');
      } else if (context.extension?.macro?.isConfiguring === true) {
        setMode('macroConfig');
      } else {
        setMode('macro');
      }
    });
  }, []);

  switch (mode) {
    case 'macroConfig':
      return <ConfigScreen />;
    case 'macro':
      return <App />;
    case 'spacePage':
      return <ModelExplorer />;
    default:
      return null;
  }
}

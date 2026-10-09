// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { EVALUATIONS, SKILLS } from '../../domain/codes';
import { useI18n } from '../../i18n';

// Free ball is in the vocabulary but neither on the form nor in the manual entry.
const SHOWN = SKILLS.filter((skill) => skill !== 'F');

export function CodeLegend() {
  const { m } = useI18n();
  return (
    <div className="vr-codes">
      {SHOWN.map((skill) => {
        const meanings = m.codes[skill];
        return (
          <section key={skill} className="vr-code-skill">
            <h3>
              <span className="vr-code-letter">{skill}</span>
              {m.skills[skill]}
            </h3>
            <dl>
              {EVALUATIONS.filter((e) => meanings[e]).map((e) => (
                <div key={e} style={{ display: 'contents' }}>
                  <dt>
                    {skill}
                    {e}
                  </dt>
                  <dd>{meanings[e]}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}

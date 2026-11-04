"""Diagnostic replay of a supplied test visit, including visits excluded from a merchant audit.
Reuse AgentCoSign's renderer and app; do not change its eligibility judgments.
"""

import json, os, shutil, sys
from pathlib import Path

root = Path(os.environ['AGENTCOSIGN_ROOT'])
sys.path.insert(0, str(root / 'src'))
from primitives import Subject, Status, read_judgments
from report_view.build import Builder, Shown, STEPS
from report_view.models import Text
from report_view import pages
from report_view.__main__ import document_text
from rules.inputs import load


class Diagnostic(Builder):
    def _shown(self, visits):
        shown = super()._shown(visits)
        for n, v in visits.items():
            if n in shown:
                continue
            subject = Subject.of_visit(n)
            kinds = {
                r.subject.step: r.payload['kind']
                for r in self.j.results_of('step-kind')
                if r.subject.visit == n and r.status is Status.HELD
            }
            landed = self.j.result('errand-outcome', subject)
            reached = self.j.result('reached', subject)
            shown[n] = Shown(
                n=n,
                name=v.packet.persona['name'],
                outcome=landed.payload['outcome'],
                steps=[name for name, ks in STEPS if set(kinds.values()) & set(ks)],
                reached=reached is not None and reached.status is Status.HELD,
                wall_step=None,
                wall_kind=None,
                answers={},
                named=set(),
                kinds=kinds,
                visit=v,
            )
        return shown


p = Path(sys.argv[1])
out = p / 'replay'
j = read_judgments(json.loads((p / 'judgments.json').read_text()), str(p / 'judgments.json'))
b = Diagnostic(
    j,
    json.loads((p / 'batch.json').read_text()),
    load([p / 'agent']),
    None,
    'diagnostic-shopping-replay',
    ('en',),
)
doc = b.document()
doc = doc.model_copy(
    update={
        'header': doc.header.model_copy(
            update={
                'title': Text(
                    en='Diagnostic replay — supplied test visit, not a merchant audit', zh='Diagnostic replay'
                )
            }
        )
    }
)
(out / 'view.json').write_text(document_text(doc))
for name, source in b.files.items():
    (out / name).parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, out / name)
pages.write_shells(doc, out, str(root / 'app/dist'))
(out / 'DIAGNOSTIC.md').write_text(
    'This page includes the supplied test visit even when the merchant-audit eligibility rule does not count it. The original judgments are unchanged. Page frames, dialogue, actions and outcome come from the recorded run.\n'
)
print(f'Diagnostic replay: {len(doc.visits)} supplied visits, {len(b.files)} pictures')

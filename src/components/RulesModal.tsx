import { X } from 'lucide-react';
import { LarsAvatar } from './LarsAvatar';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPECIAL_COMBOS = [
  { name: 'Lille', condition: '1–2–3–4–5', points: '500' },
  { name: 'Stor', condition: '2–3–4–5–6', points: '1.000' },
  { name: 'Cameron', condition: '1–2–3–4–5–6', points: '2.000' },
  { name: '3 par', condition: 'Tre vilkårlige par', points: '1.500' },
  { name: '2 × 3 ens', condition: 'To sæt af tre ens (kun på første slag)', points: '2.500' },
];

const TRIPLES = [
  { dice: "3 × 1'ere", points: '1.000' },
  { dice: "3 × 2'ere", points: '200' },
  { dice: "3 × 3'ere", points: '300' },
  { dice: "3 × 4'ere", points: '400' },
  { dice: "3 × 5'ere", points: '500' },
  { dice: "3 × 6'ere", points: '600' },
];

export function RulesModal({ isOpen, onClose }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88dvh] overflow-y-auto rounded-2xl bg-white dark:bg-[#0d2749] border border-slate-200 dark:border-sky-800/60 shadow-2xl text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 bg-white/95 dark:bg-[#0d2749]/95 border-b border-slate-200 dark:border-sky-800/50">
          <div className="flex items-center gap-3 min-w-0">
            <LarsAvatar sizeClass="w-10 h-10" className="ring-2 ring-amber-400/70" />
            <div className="min-w-0">
              <h2 id="rules-modal-title" className="font-display text-xl font-bold truncate">
                Officielle spilleregler — 10000 Lars
              </h2>
              <p className="text-xs text-slate-500 dark:text-sky-200/70">
                Pointoversigt, særregler og slutspil
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Luk spilleregler"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-sky-200/70 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-sky-900/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 text-sm leading-relaxed">
          <section>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mb-1.5">
              Målet med spillet & Slutspil
            </h3>
            <p className="text-slate-600 dark:text-sky-100/85">
              Den spiller, der ender <strong className="text-slate-900 dark:text-white">længst over 10.000 point</strong>, vinder spillet.
              Når en spiller runder 10.000 point, spilles kun den igangværende runde færdig for de øvrige spillere længere nede i turrækkefølgen. Rammer den sidste spiller i runden højest over 10.000, afsluttes spillet øjeblikkeligt.
            </p>
          </section>

          <section>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mb-2">
              Kom i gang & minimumskrav
            </h3>
            <ul className="space-y-1.5 text-slate-600 dark:text-sky-100/85 list-disc pl-5">
              <li>
                <strong className="text-slate-900 dark:text-white">Åbning:</strong> Du skal opnå mindst{' '}
                <span className="font-mono tabular-nums font-semibold">1.000</span> point på én samlet tur for at komme på tavlen.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Videre spil:</strong> Når du er kommet på tavlen, skal du fremover opnå mindst{' '}
                <span className="font-mono tabular-nums font-semibold">350</span> point pr. tur for at få dine point noteret.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Nul-ture (strafpoint):</strong> Får du ikke point i{' '}
                <span className="font-semibold">3 ture i træk</span>, trækkes der{' '}
                <span className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">-1.000</span> point fra din samlede score.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Alle 6 terninger brugt:</strong> Hvis alle 6 terninger låses med point i samme tur, må du kaste alle 6 terninger på ny med din tur-score intakt.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mb-2.5">
              Særlige kombinationer & point
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-sky-800/60">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-[#143763] text-slate-700 dark:text-sky-100 text-xs">
                    <th className="py-2.5 px-3.5 font-semibold">Kombination</th>
                    <th className="py-2.5 px-3.5 font-semibold">Betingelse / Terninger</th>
                    <th className="py-2.5 px-3.5 font-semibold text-right">Point</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-sky-800/40">
                  {SPECIAL_COMBOS.map((row) => (
                    <tr key={row.name} className="bg-white dark:bg-[#0b213f]">
                      <td className="py-2.5 px-3.5 font-semibold text-slate-900 dark:text-white">
                        {row.name}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-600 dark:text-sky-100/80">
                        {row.condition}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                        {row.points}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-white dark:bg-[#0b213f]">
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900 dark:text-white">
                      Enkelt 1'er / 5'er
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600 dark:text-sky-100/80">
                      Hver enkelt 1'er eller 5'er uden for kombination
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                      100 / 50
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white mb-2">
              3 ens & fordobling
            </h3>
            <p className="text-slate-600 dark:text-sky-100/85 mb-3">
              Slår du 3 ens — eksempelvis tre 5'ere, som giver <span className="font-mono tabular-nums font-semibold">500</span> point — og du i samme eller efterfølgende slag i turen slår endnu en 5'er, <strong className="text-slate-900 dark:text-white">fordobles dine point for hver ekstra terning</strong> (4 ens = 2×, 5 ens = 4×, 6 ens = 8×). Dette gælder for alle terningværdier.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TRIPLES.map((t) => (
                <div
                  key={t.dice}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#113058] border border-slate-200 dark:border-sky-800/40"
                >
                  <span className="font-medium text-slate-700 dark:text-sky-100">{t.dice}</span>
                  <span className="font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                    {t.points}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

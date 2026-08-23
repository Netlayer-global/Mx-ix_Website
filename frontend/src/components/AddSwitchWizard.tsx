import React, { useCallback, useEffect, useState } from 'react';
import { Server, Check, ArrowRight, Loader2, X, Router as RouterIcon } from 'lucide-react';
import { adminFabricApi, CabinetItem, InfrastructureItem, FacilityItem } from '../services/api';

interface Props {
  onClose: () => void;
  onDone?: (deviceId: string) => void;
}

type Step = 'location' | 'device' | 'ports' | 'done';

const VENDORS = [
  'Huawei', 'Cisco', 'Arista', 'Juniper', 'Dell', 'Mellanox', 'Edgecore',
  'FS.com', 'Celestica', 'Nokia', 'MikroTik', 'Other',
];

const SPEEDS: { label: string; value: number }[] = [
  { label: '1G', value: 1000 },
  { label: '10G', value: 10000 },
  { label: '25G', value: 25000 },
  { label: '40G', value: 40000 },
  { label: '100G', value: 100000 },
  { label: '400G', value: 400000 },
];

const field = 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#F20732] transition-colors';

/**
 * AddSwitchWizard — 3-step modal to quickly add a switch:
 *   Step 1: Pick the infrastructure + facility + rack
 *   Step 2: Name, vendor, model, U position, height
 *   Step 3: Generate ports (count, speed, naming pattern)
 */
const AddSwitchWizard: React.FC<Props> = ({ onClose, onDone }) => {
  const [step, setStep] = useState<Step>('location');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Step 1 state
  const [infras, setInfras] = useState<InfrastructureItem[]>([]);
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [cabinets, setCabinets] = useState<CabinetItem[]>([]);
  const [infraId, setInfraId] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [cabinetId, setCabinetId] = useState('');

  // Step 2 state
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [model, setModel] = useState('');
  const [startU, setStartU] = useState(1);
  const [heightU, setHeightU] = useState(1);
  const [hostname, setHostname] = useState('');

  // Step 3 state
  const [portCount, setPortCount] = useState(48);
  const [portSpeed, setPortSpeed] = useState(10000);
  const [portPattern, setPortPattern] = useState('Ethernet1/{n}');

  // Result
  const [createdDeviceId, setCreatedDeviceId] = useState('');
  const [portsResult, setPortsResult] = useState<{ created: number } | null>(null);

  // Load infras on mount
  useEffect(() => {
    adminFabricApi.listInfrastructures().then((r) => {
      if (r.success && r.data) {
        setInfras(r.data);
        if (r.data.length === 1) setInfraId(r.data[0]._id);
      }
    });
  }, []);

  // Load facilities when infra changes
  useEffect(() => {
    if (!infraId) return;
    adminFabricApi.listFacilities(infraId).then((r) => {
      if (r.success && r.data) {
        setFacilities(r.data);
        if (r.data.length === 1) setFacilityId(r.data[0]._id);
      }
    });
  }, [infraId]);

  // Load cabinets when facility changes
  useEffect(() => {
    if (!facilityId) return;
    adminFabricApi.listCabinets(facilityId).then((r) => {
      if (r.success && r.data) {
        setCabinets(r.data);
        if (r.data.length === 1) setCabinetId(r.data[0]._id);
      }
    });
  }, [facilityId]);

  const createDevice = async () => {
    setError('');
    setBusy(true);
    const res = await adminFabricApi.createDevice({
      infrastructure: infraId,
      cabinet: cabinetId,
      name: name.trim(),
      hostname: hostname.trim() || undefined,
      deviceType: 'switch',
      vendor,
      hardwareModel: model.trim() || undefined,
      startU,
      heightU,
    } as any);
    setBusy(false);
    if (res.success && res.data) {
      setCreatedDeviceId(res.data._id);
      setStep('ports');
    } else {
      setError(res.error || 'Failed to create the switch.');
    }
  };

  const generatePorts = async () => {
    if (!createdDeviceId) return;
    setError('');
    setBusy(true);
    const res = await adminFabricApi.generatePorts(createdDeviceId, {
      pattern: portPattern,
      speed: portSpeed,
      type: 'sfp+',
    });
    setBusy(false);
    if (res.success && res.data) {
      setPortsResult(res.data);
      setStep('done');
    } else {
      setError(res.error || 'Failed to generate ports.');
    }
  };

  const stepTitles: Record<Step, string> = {
    location: 'Where to place it',
    device: 'Switch details',
    ports: 'Generate ports',
    done: 'Done!',
  };

  const STEPS: Step[] = ['location', 'device', 'ports', 'done'];
  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#F20732] rounded-lg flex items-center justify-center">
              <Server className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white">Add Switch</h2>
              <p className="text-xs text-gray-400">Step {stepIdx + 1} of 4 — {stepTitles[step]}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-6 pt-4">
          {STEPS.map((s, i) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${i <= stepIdx ? 'bg-[#F20732]' : 'bg-gray-700'}`} />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4 text-white min-h-[280px]">
          {error && <p className="text-sm text-[#F20732] bg-[#F20732]/10 border border-[#F20732]/30 rounded p-3">{error}</p>}

          {step === 'location' && (
            <>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Infrastructure</label>
                <select className={field} value={infraId} onChange={(e) => setInfraId(e.target.value)}>
                  <option value="">Select…</option>
                  {infras.map((i) => <option key={i._id} value={i._id}>{i.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Data Center</label>
                <select className={field} value={facilityId} onChange={(e) => setFacilityId(e.target.value)} disabled={!infraId}>
                  <option value="">Select…</option>
                  {facilities.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Rack</label>
                <select className={field} value={cabinetId} onChange={(e) => setCabinetId(e.target.value)} disabled={!facilityId}>
                  <option value="">Select…</option>
                  {cabinets.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.uHeight}U)</option>)}
                </select>
              </div>
            </>
          )}

          {step === 'device' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Name *</label>
                  <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SW-DEL-01" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Hostname</label>
                  <input className={field} value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="sw-del-01.mx-ix.net" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Vendor *</label>
                  <select className={field} value={vendor} onChange={(e) => setVendor(e.target.value)}>
                    <option value="">Select…</option>
                    {VENDORS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Model</label>
                  <input className={field} value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. CE6881-48S6CQ" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Start U position *</label>
                  <input type="number" className={field} value={startU} onChange={(e) => setStartU(Number(e.target.value))} min={1} max={42} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Height (U) *</label>
                  <input type="number" className={field} value={heightU} onChange={(e) => setHeightU(Number(e.target.value))} min={1} max={10} />
                </div>
              </div>
            </>
          )}

          {step === 'ports' && (
            <>
              <p className="text-sm text-gray-300">
                Switch <strong>{name}</strong> created. Now generate its ports so they're available for member provisioning.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Port count</label>
                  <input type="number" className={field} value={portCount} onChange={(e) => setPortCount(Number(e.target.value))} min={1} max={256} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">Port speed</label>
                  <select className={field} value={portSpeed} onChange={(e) => setPortSpeed(Number(e.target.value))}>
                    {SPEEDS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider font-mono block mb-1.5">
                  Naming pattern <span className="text-gray-600">({'{n}'} = port number)</span>
                </label>
                <input className={field} value={portPattern} onChange={(e) => setPortPattern(e.target.value)} placeholder="Ethernet1/{n}" />
                <p className="text-[11px] text-gray-500 mt-1">Preview: {portPattern.replace('{n}', '1')}, {portPattern.replace('{n}', '2')}, …, {portPattern.replace('{n}', String(portCount))}</p>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-green-500/15 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-2">Switch ready!</h3>
              <p className="text-gray-400 text-sm">
                <strong>{name}</strong> is mounted at U{startU} with {portsResult?.created || portCount} ports at {SPEEDS.find((s) => s.value === portSpeed)?.label}.
                <br />It's now available for member provisioning.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-700">
          {step !== 'done' && (
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
          )}
          {step === 'location' && (
            <button
              onClick={() => setStep('device')}
              disabled={!cabinetId}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm text-white hover:bg-[#C00628] disabled:opacity-50 transition-colors"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {step === 'device' && (
            <>
              <button onClick={() => setStep('location')} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Back</button>
              <button
                onClick={createDevice}
                disabled={busy || !name.trim() || !vendor}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm text-white hover:bg-[#C00628] disabled:opacity-50 transition-colors"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />} Create switch
              </button>
            </>
          )}
          {step === 'ports' && (
            <>
              <button onClick={() => { setStep('done'); onDone?.(createdDeviceId); }} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Skip</button>
              <button
                onClick={generatePorts}
                disabled={busy || portCount < 1}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 rounded font-bold text-sm text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Generate {portCount} ports
              </button>
            </>
          )}
          {step === 'done' && (
            <button
              onClick={() => { onClose(); onDone?.(createdDeviceId); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#F20732] rounded font-bold text-sm text-white hover:bg-[#C00628] transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddSwitchWizard;

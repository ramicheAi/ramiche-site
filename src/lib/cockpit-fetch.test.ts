import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cockpitFetch } from './cockpit-fetch';
const transport=vi.fn();
beforeEach(()=>{vi.stubGlobal('window',{location:{origin:'https://cockpit.example'}});vi.stubGlobal('fetch',transport);});
afterEach(()=>{vi.unstubAllGlobals();vi.resetAllMocks();});
it('fetches session evidence before mutation and forwards the issued token',async()=>{transport.mockResolvedValueOnce(Response.json({token:'fixture-csrf'})).mockResolvedValueOnce(Response.json({ok:true}));await cockpitFetch('/api/command-center/gate',{method:'POST',body:'{}'});expect(transport).toHaveBeenCalledTimes(2);expect(transport.mock.calls[0][0]).toBe('/api/command-center/csrf');expect(new Headers(transport.mock.calls[1][1].headers).get('x-parallax-csrf')).toBe('fixture-csrf');});
it('does not dispatch if evidence cannot be obtained',async()=>{transport.mockResolvedValueOnce(Response.json({error:'denied'},{status:401}));await expect(cockpitFetch('/api/bridge',{method:'PATCH'})).rejects.toThrow();expect(transport).toHaveBeenCalledTimes(1);});
it('does not retry a failed mutation',async()=>{transport.mockResolvedValueOnce(Response.json({token:'fixture'})).mockRejectedValueOnce(Error('connection lost'));await expect(cockpitFetch('/api/bridge',{method:'PATCH'})).rejects.toThrow();expect(transport).toHaveBeenCalledTimes(2);});
it('does not send CSRF evidence to another origin',async()=>{transport.mockResolvedValueOnce(Response.json({}));await cockpitFetch('https://external.example/api/bridge',{method:'POST'});expect(transport).toHaveBeenCalledTimes(1);expect(transport.mock.calls[0][1].headers).toBeUndefined();});

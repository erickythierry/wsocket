import { BinaryNode } from '../WABinary'
import { buildAckStanza } from '../Utils/stanza-ack'

const ME_ID = '5511999999999@s.whatsapp.net'

const makeNode = (tag: string, attrs: Record<string, string>, content?: BinaryNode[]): BinaryNode => ({
	tag,
	attrs,
	content
})

describe('buildAckStanza', () => {
	it('builds a minimal ack for a successful message stanza (no type, no from)', () => {
		const node = makeNode('message', { id: 'M1', from: '123@s.whatsapp.net', type: 'text' })
		const ack = buildAckStanza(node, undefined, ME_ID)
		expect(ack).toBeDefined()
		expect(ack!.tag).toBe('ack')
		expect(ack!.attrs).toEqual({
			id: 'M1',
			to: '123@s.whatsapp.net',
			class: 'message'
		})
	})

	it('injects from=meId and echoes type when message has <unavailable> child', () => {
		const node = makeNode(
			'message',
			{ id: 'M2', from: '123@s.whatsapp.net', type: 'text' },
			[makeNode('unavailable', {})]
		)
		const ack = buildAckStanza(node, undefined, ME_ID)
		expect(ack!.attrs).toEqual({
			id: 'M2',
			to: '123@s.whatsapp.net',
			class: 'message',
			type: 'text',
			from: ME_ID
		})
	})

	it('echoes type and adds error on message ack with errorCode', () => {
		const node = makeNode('message', { id: 'M3', from: '123@s.whatsapp.net', type: 'text' })
		const ack = buildAckStanza(node, 487, ME_ID)
		expect(ack!.attrs.error).toBe('487')
		expect(ack!.attrs.type).toBe('text')
		expect(ack!.attrs.from).toBeUndefined()
	})

	it('always echoes type for non-message stanzas (receipt)', () => {
		const node = makeNode('receipt', { id: 'R1', from: '123@s.whatsapp.net', type: 'read' })
		const ack = buildAckStanza(node, undefined, ME_ID)
		expect(ack!.attrs.class).toBe('receipt')
		expect(ack!.attrs.type).toBe('read')
		expect(ack!.attrs.from).toBeUndefined()
	})

	it('always echoes type for notification stanzas', () => {
		const node = makeNode('notification', { id: 'N1', from: '123@s.whatsapp.net', type: 'devices' })
		const ack = buildAckStanza(node, undefined, ME_ID)
		expect(ack!.attrs.type).toBe('devices')
		expect(ack!.attrs.class).toBe('notification')
	})

	it('echoes participant and recipient when present', () => {
		const node = makeNode('message', {
			id: 'M4',
			from: '999-111@g.us',
			participant: '222@s.whatsapp.net',
			recipient: '333@s.whatsapp.net'
		})
		const ack = buildAckStanza(node, undefined, ME_ID)
		expect(ack!.attrs.participant).toBe('222@s.whatsapp.net')
		expect(ack!.attrs.recipient).toBe('333@s.whatsapp.net')
	})

	it('returns undefined when id is missing', () => {
		const node = makeNode('message', { from: '123@s.whatsapp.net' })
		expect(buildAckStanza(node, undefined, ME_ID)).toBeUndefined()
	})

	it('returns undefined when from is missing', () => {
		const node = makeNode('message', { id: 'M5' })
		expect(buildAckStanza(node, undefined, ME_ID)).toBeUndefined()
	})

	it('does not inject from when meId is undefined (unavailable case)', () => {
		const node = makeNode(
			'message',
			{ id: 'M6', from: '123@s.whatsapp.net' },
			[makeNode('unavailable', {})]
		)
		const ack = buildAckStanza(node, undefined, undefined)
		expect(ack!.attrs.from).toBeUndefined()
	})

	it('treats errorCode=0 as no error (no error attr, message ack drops type)', () => {
		const node = makeNode('message', { id: 'M7', from: '123@s.whatsapp.net', type: 'text' })
		const ack = buildAckStanza(node, 0, ME_ID)
		expect(ack!.attrs.error).toBeUndefined()
		expect(ack!.attrs.type).toBeUndefined()
	})
})

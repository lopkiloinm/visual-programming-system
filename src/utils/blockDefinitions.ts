import { BlockCategory } from '../types/blocks';

export const blockCategories: BlockCategory[] = [
  {
    name: 'Events',
    color: '#dc2626',
    blocks: [
      {
        id: 'when_setup',
        label: 'when setup',
        category: 'Events',
        color: '#dc2626',
        type: 'event',
        code: '${content}' // Content will be placed in setup() function
      },
      {
        id: 'when_draw',
        label: 'when draw (loop)',
        category: 'Events',
        color: '#dc2626',
        type: 'event',
        code: '${content}' // Content will be placed directly in draw() or drawSprites()
      },
      {
        id: 'when_clicked',
        label: 'when clicked',
        category: 'Events',
        color: '#dc2626',
        type: 'event',
        code: 'function mousePressed() {\n${content}\n}'
      }
    ]
  },
  {
    name: 'Control',
    color: '#7c3aed',
    blocks: [
      {
        id: 'wait_frames',
        label: 'wait ⏱️ frames',
        category: 'Control',
        color: '#7c3aed',
        type: 'control',
        inputs: [
          { type: 'number', name: 'frames', defaultValue: 30 }
        ],
        code: 'sprites[0].waitUntilFrame = globalFrameCount + ${frames};'
      }
    ]
  },
  {
    name: 'Drawing',
    color: '#059669',
    blocks: [
      {
        id: 'draw_circle',
        label: 'draw circle at mouse',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        code: 'circle(mouseX, mouseY, 50);'
      },
      {
        id: 'set_fill',
        label: 'set fill color',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        inputs: [
          { type: 'text', name: 'color', defaultValue: 'red' }
        ],
        code: 'fill("${color}");'
      },
      {
        id: 'set_background',
        label: 'set background color',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        inputs: [
          { type: 'text', name: 'color', defaultValue: 'lightblue' }
        ],
        code: 'background("${color}");'
      },
      {
        id: 'draw_rect',
        label: 'draw rectangle',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        inputs: [
          { type: 'number', name: 'x', defaultValue: 100 },
          { type: 'number', name: 'y', defaultValue: 100 },
          { type: 'number', name: 'w', defaultValue: 50 },
          { type: 'number', name: 'h', defaultValue: 50 }
        ],
        code: 'rect(${x}, ${y}, ${w}, ${h});'
      },
      {
        id: 'draw_circle_at',
        label: 'draw circle at position',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        inputs: [
          { type: 'number', name: 'x', defaultValue: 240 },
          { type: 'number', name: 'y', defaultValue: 180 },
          { type: 'number', name: 'size', defaultValue: 30 }
        ],
        code: 'circle(${x}, ${y}, ${size});'
      },
      {
        id: 'draw_sprite_circle',
        label: 'draw circle at sprite',
        category: 'Drawing',
        color: '#059669',
        type: 'action',
        inputs: [
          { type: 'number', name: 'size', defaultValue: 30 }
        ],
        code: 'circle(sprites[0].x, sprites[0].y, ${size});'
      }
    ]
  },
  {
    name: 'Motion',
    color: '#2563eb',
    blocks: [
      {
        id: 'move_sprite',
        label: 'move sprite by',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        inputs: [
          { type: 'number', name: 'x', defaultValue: 10 },
          { type: 'number', name: 'y', defaultValue: 10 }
        ],
        code: 'sprites[0].x += ${x}; sprites[0].y += ${y};'
      },
      {
        id: 'set_sprite_position',
        label: 'set sprite position',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        inputs: [
          { type: 'number', name: 'x', defaultValue: 240 },
          { type: 'number', name: 'y', defaultValue: 180 }
        ],
        code: 'sprites[0].x = ${x}; sprites[0].y = ${y};'
      },
      {
        id: 'move_to_mouse',
        label: 'move sprite to mouse',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        code: 'sprites[0].x = mouseX; sprites[0].y = mouseY;'
      },
      {
        id: 'change_sprite_color',
        label: 'change sprite color',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        inputs: [
          { type: 'text', name: 'color', defaultValue: 'red' }
        ],
        code: 'sprites[0].color = "${color}";'
      },
      {
        id: 'change_sprite_size',
        label: 'change sprite size',
        category: 'Motion',
        color: '#2563eb',
        type: 'action',
        inputs: [
          { type: 'number', name: 'size', defaultValue: 50 }
        ],
        code: 'sprites[0].size = ${size};'
      }
    ]
  }
];
const { registerBlockType } = wp.blocks;
const { InspectorControls } = wp.blockEditor;
const { PanelBody, ToggleControl, RangeControl, TextControl } = wp.components;
const { createElement: el, Fragment } = wp.element;
const { __ } = wp.i18n;

registerBlockType('bridge/results', {
    title: __('Bridge Tournament Results'),
    icon: 'awards',
    category: 'widgets',
    attributes: {
        numberOfResults: { type: 'number', default: 10 },
        filterTourneyType: { type: 'string', default: '' },
        showCategory: { type: 'boolean', default: true },
        showLocation: { type: 'boolean', default: true },
        showImages: { type: 'boolean', default: true },
        showTableHeader: { type: 'boolean', default: true },
        showTourneyType: { type: 'boolean', default: true },
        showDate: { type: 'boolean', default: true },
        useDefaultImage: { type: 'boolean', default: false },
        defaultImageUrl: { type: 'string', default: '' }

    },
    edit: ({ attributes, setAttributes }) => {
        return el(Fragment, {},
            el(InspectorControls, {},
                el(PanelBody, { title: __('Block Settings') },
                    el(RangeControl, {
                        label: __('Number of Results'),
                        value: attributes.numberOfResults,
                        onChange: (val) => setAttributes({ numberOfResults: val }),
                        min: 1,
                        max: 100
                    }),
                    el(TextControl, {
                        label: __('Filter by Tournament Type'),
                        value: attributes.filterTourneyType,
                        onChange: (val) => setAttributes({ filterTourneyType: val })
                    }),
                    el(ToggleControl, {
                        label: __('Show Date'),
                        checked: attributes.showDate,
                        onChange: (val) => setAttributes({ showDate: val })
                    }),
                    el(ToggleControl, {
                        label: __('Show Tourney Name'),
                        checked: attributes.showTournament,
                        onChange: (val) => setAttributes({ showTournament: val })
                    }),
                    el(ToggleControl, {
                        label: __('Show Category'),
                        checked: attributes.showCategory,
                        onChange: (val) => setAttributes({ showCategory: val })
                    }),
                    el(ToggleControl, {
                        label: __('Show Type'),
                        checked: attributes.showTourneyType,
                        onChange: (val) => setAttributes({ showTourneyType: val })
                    }),
                    el(ToggleControl, {
                        label: __('Show Location'),
                        checked: attributes.showLocation,
                        onChange: (val) => setAttributes({ showLocation: val })
                    }),
                    el(ToggleControl, {
                        label: __('Show Featured Image'),
                        checked: attributes.showImages,
                        onChange: (val) => setAttributes({ showImages: val })
                    }),
                    el(ToggleControl, {
                        label: __('Use Default Image'),
                        checked: attributes.useDefaultImage,
                        onChange: (val) => setAttributes({ useDefaultImage: val })
                    }),
                    el(TextControl, {
                        label: __('Default Image URL'),
                        value: attributes.defaultImageUrl,
                        onChange: (val) => setAttributes({ defaultImageUrl: val })
                    }),
                    el(ToggleControl, {
                        label: __('Show Table Header'),
                        checked: attributes.showTableHeader,
                        onChange: (val) => setAttributes({ showTableHeader: val })
                    })
                )
            ),
            el('div', { className: 'bridge-block-placeholder' },
                __('Bridge Results block preview')
            )
        );
    },
    save: () => null
});

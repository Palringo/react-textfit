import { useEffect, useRef, useState } from 'react';
import shallowEqual from './utils/shallowEqual';
import series from './utils/series';
import whilst from './utils/whilst';
import throttle from './utils/throttle';
import uniqueId from './utils/uniqueId';
import { innerWidth, innerHeight } from './utils/innerSize';

function assertElementFitsWidth(el, width) {
    return el.scrollWidth / width;
}

function assertElementFitsHeight(el, height) {
    return el.scrollHeight / height;
}

function noop() {}

const defaultProps = {
    min: 1,
    max: 100,
    mode: 'multi',
    forceSingleModeWidth: true,
    throttle: 50,
    autoResize: true,
    onReady: noop,
};

const Textfit = ({ props = defaultProps }) => {

    const pid = useRef(null);

    const [state, setState] = useState({
        ready: false,
        fontSize: null,
    });

    const handleWindowResize = () => {
        if (!props.autoResize) {
            return Promise.resolve();
        }

        process();
    };

    // Handle initial render
    useEffect(() => {
        console.log(process.env.NODE_ENV);

        throttle(handleWindowResize, props.throttle);
        window.addEventListener('resize', handleWindowResize);

        // eslint-disable-next-line no-unused-expressions
        () => {
            window.removeEventListener('resize', handleWindowResize);

            pid.current = uniqueId();
        };

    }, []);

    // Handle updates
    useEffect(() => {
        if (!state.ready) {
            return;
        }

        process();
    });

    const process = () => {
        const { min, max, mode, forceSingleModeWidth, onReady } = props;
        const el = this._parent;
        const wrapper = this._child;

        const originalWidth = innerWidth(el);
        const originalHeight = innerHeight(el);

        if (originalHeight <= 0 || isNaN(originalHeight)) {
            console.warn('Can not process element without height. Make sure the element is displayed and has a static height.');
            return;
        }

        if (originalWidth <= 0 || isNaN(originalWidth)) {
            console.warn('Can not process element without width. Make sure the element is displayed and has a static width.');
            return;
        }

        pid.current = uniqueId();

        const shouldCancelProcess = () => pid !== pid.current;

        const testPrimary = mode === 'multi' ?
            () => assertElementFitsHeight(wrapper, originalHeight) :
            () => assertElementFitsWidth(wrapper, originalWidth);

        const testSecondary = mode === 'multi' ?
            () => assertElementFitsWidth(wrapper, originalWidth) :
            () => assertElementFitsHeight(wrapper, originalHeight);

        const fontSize = state.fontSize;
        let mid;
        let proportion;
        let proportionUsed = 0;
        let low = min;
        let high = max;

        setState((prevState) => ({ ...prevState, ready: false }));

        series([
            // Step 1:
            // Binary search to fit the element's height (multi line) / width (single line)
            (stepCallback) => whilst(
                () => low <= high,
                (whilstCallback) => {
                    if (shouldCancelProcess()) { return whilstCallback(true); }
                    if (proportionUsed >= 2) {
                        mid = Math.floor((low + high) / 2);
                    } else {
                        if (proportionUsed === 0) {
                            mid = fontSize;
                        } else {
                            mid = Math.floor(mid / proportion);
                        }
                        proportionUsed = proportionUsed + 1;
                    }
                    setState((prevState) => ({ ...prevState, fontSize: mid }), () => {
                        if (shouldCancelProcess()) {
                            return whilstCallback(true);
                        }
                        proportion = testPrimary();
                        if (proportion === 1) {
                            low = high = mid;
                        } else if (proportion <= 1) {
                            low = mid + 1;
                        } else {
                            high = mid - 1;
                        }
                        return whilstCallback();
                    });
                },
                stepCallback,
            ),

            // Step 2:
            // Binary search to fit the element's width (multi line) / height (single line)
            // If mode is single and forceSingleModeWidth is true, skip this step
            // in order to not fit the elements height and decrease the width
            (stepCallback) => {
                if (mode === 'single' && forceSingleModeWidth) {
                    return stepCallback();
                }
                if (testSecondary()) {
                    return stepCallback();
                }
                low = min;
                high = mid;
                mid = undefined;
                proportionUsed = 0;
                return whilst(
                    () => low <= high,
                    (whilstCallback) => {
                        if (shouldCancelProcess()) {
                            return whilstCallback(true);
                        }
                        if (mid === undefined || proportionUsed >= 1) {
                            mid = Math.floor((low + high) / 2);
                        } else {
                            mid = Math.floor(mid / proportion);
                            proportionUsed = proportionUsed + 1;
                        }
                        setState((prevState) => ({ ...prevState, fontSize: mid }), () => {
                            if (pid !== pid.current) {
                                return whilstCallback(true);
                            }
                            proportion = testSecondary();

                            if (proportion === 1) {
                                low = high = mid;
                            } else if (proportion <= 1) {
                                low = mid + 1;
                            } else {
                                high = mid - 1;
                            }
                            return whilstCallback();
                        });
                    },
                    stepCallback,
                );
            },

            // Step 3
            // Limits
            (stepCallback) => {
                // We break the previous loop without updating mid for the final time,
                // so we do it here:
                mid = Math.min(low, high) - 1;

                // Ensure we hit the user-supplied limits
                mid = Math.max(mid, min);
                mid = Math.min(mid, max);

                // Sanity check:
                mid = Math.max(mid, 0);

                if (shouldCancelProcess()) { return stepCallback(true); }
                setState((prevState) => ({ ...prevState, fontSize: mid }), stepCallback);
            },
        ], (err) => {
            // err will be true, if another process was triggered
            if (err || shouldCancelProcess()) { return; }
            setState((prevState) => ({ ...prevState, ready: true }), () => onReady(mid));
        });
    };

    return (() => {
        const { children, text, style, min, max, mode, forceWidth, forceSingleModeWidth, throttle, autoResize, onReady, ...props } = props;
        const finalStyle = { ...style, fontSize: state.fontSize };

        const wrapperStyle = {
            display: state.ready ? 'block' : 'inline-block',
            whiteSpace: mode === 'single' ? 'nowrap' : '',
        };

        return (
            <div ref={(c) => this._parent = c} style={finalStyle} {...props}>
                <div ref={(c) => this._child = c} style={wrapperStyle}>
                    {text && typeof children === 'function' ?
                        state.ready ?
                            children(text) :
                            text :
                        children
                    }
                </div>
            </div>
        );
    });
};

export default Textfit;

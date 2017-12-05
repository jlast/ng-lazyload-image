import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/take';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/mergeMap';
import 'rxjs/add/operator/catch';
import 'rxjs/add/observable/of';
import { Observable } from 'rxjs/Observable';
import { getScrollListener } from './scroll-listener';

export function isVisible(element: HTMLElement, threshold = 0, _window = window) {
    const { top, bottom, left, right } = element.getBoundingClientRect();
    const height = _window.innerHeight;
    const width = _window.innerWidth;
    // Is the element in viewport but larger then viewport itself
    const elementLargerThenViewport = top <= -threshold && bottom >= (height + threshold) && left <= -threshold && right >= (width + threshold);
    // Is the top of the element in the viewport
    const topInsideViewport = top <= (height + threshold) && top >= -threshold;
    // Is the bottom of the element in the viewport
    const bottomInsideViewport = bottom >= -threshold && bottom <= (height + threshold);
    // Is the right side of the element in the viewport
    const rightsideInViewport = right >= -threshold && right <= (width + threshold);
    // Is the left side of the element is the viewport
    const leftsideInViewport = left <= (width + threshold) && left >= -threshold;

    return (
        elementLargerThenViewport ||
        ((topInsideViewport || bottomInsideViewport) &&
        (rightsideInViewport || leftsideInViewport))
    );
}

export function isChildOfPicture(element: HTMLImageElement | HTMLDivElement): boolean {
    return Boolean(element.parentElement && element.parentElement.nodeName.toLowerCase() === 'picture');
}

export function isImageElement(element: HTMLImageElement | HTMLDivElement): element is HTMLImageElement {
    return element.nodeName.toLowerCase() === 'img';
}

function loadImage(element: HTMLImageElement | HTMLDivElement, imagePath: string, useSrcset: boolean, sourcesAttrName: string): Observable<string> {
    let img: HTMLImageElement;
    if (isImageElement(element) && isChildOfPicture(element)) {
        const parentClone = <HTMLPictureElement>element.parentNode.cloneNode(true);
        img = <HTMLImageElement>parentClone.getElementsByTagName('img')[0];
        setImage(img, imagePath, useSrcset);
    } else {
        img = new Image();
        if (isImageElement(element) && element.sizes) {
            img.sizes = element.sizes;
        }
        if (useSrcset) {
            img.srcset = imagePath;
        } else {
            img.src = imagePath;
        }
    }

    return Observable
        .create(observer => {
            img.onload = () => {
                observer.next(imagePath);
                observer.complete();
            };
            img.onerror = err => {
                observer.error(null);
            };
        });
}

function setImage(element: HTMLImageElement | HTMLDivElement, imagePath: string, useSrcset: boolean) {
    if (isImageElement(element)) {
        if (useSrcset) {
            element.srcset = imagePath;
        } else {
            element.src = imagePath;
        }
    } else {
        element.style.backgroundImage = `url('${imagePath}')`;
    }
    return element;
}

function setSources(attrName: string) {
    return (element: HTMLImageElement) => {
        const sources = element.parentElement.getElementsByTagName('source');
        for (let i = 0; i < sources.length; i++) {
            const attrValue = sources[i].getAttribute(attrName);
            if (attrValue) {
                sources[i].srcset = attrValue;
            }
        }
    }
}

const setSourcesToDefault = setSources('defaultImage');
const setSourcesToLazy = setSources('lazyImage');
const setSourcesToError = setSources('errorImage');

function setLoadedStyle(element: HTMLElement) {
    const styles = element.className
        .split(' ')
        .filter(s => !!s)
        .filter(s => s !== 'ng-lazyloading');
    styles.push('ng-lazyloaded');
    element.className = styles.join(' ');
    return element;
}

export function lazyLoadImage(image: HTMLImageElement | HTMLDivElement, imagePath: string, defaultImagePath: string, errorImgPath: string, offset: number, useSrcset: boolean = false) {
    const isImgOfPicture = isImageElement(image) && isChildOfPicture(image);
    if (isImgOfPicture) {
        setSourcesToDefault(image as HTMLImageElement);
    }
    if (defaultImagePath) {
        setImage(image, defaultImagePath, useSrcset);
    }
    if (image.className && image.className.includes('ng-lazyloaded')) {
        image.className = image.className.replace('ng-lazyloaded', '');
    }

    return (scrollObservable: Observable<Event>) => {
        return scrollObservable
            .filter(() => isVisible(image, offset))
            .take(1)
            .mergeMap(() => loadImage(image, imagePath, useSrcset, 'lazyLoad'))
            .do(() => {
                if (isImgOfPicture) {
                    setSourcesToDefault(image as HTMLImageElement);
                }
                setImage(image, imagePath, useSrcset);
            })
            .map(() => true)
            .catch(() => {
                if (isImgOfPicture) {
                    setSourcesToError(image as HTMLImageElement);
                }
                if (errorImgPath) {
                    setImage(image, errorImgPath, useSrcset);
                }
                image.className += ' ng-failed-lazyloaded';
                return Observable.of(false);
            })
            .do(() => setLoadedStyle(image));
    };
}

---
layout:     post
title:      "Java Comparable 接口的一个小「坑」"
author:     "刘文俊"
date:       2017-02-01
tags:
    - Java
---

`Comparable` 是 Java 中非常常用的一个接口，但是其中也有一些值得深究的细节。

我们以「德州扑克」游戏的业务场景为例进行说明。「德州扑克」是一款风靡世界的扑克游戏，要实现这个游戏，首先要对系统进行建模，我们可能会写出这样的一段代码：

	public enum PokerSuit {
	    SPADE, HEART, DIAMOND, CLUB
	}

	public class PokerCard {
	    private final int number;
	    private final PokerSuit suit;
	
	    public PokerCard(int number, PokerSuit suit) {
	        if (number < 1 || number > 13) {
	            throw new IllegalArgumentException("number");
	        }
	        this.number = number;
	        this.suit = Objects.requireNonNull(suit);
	    }
	
	    public int getNumber() {
	        return number;
	    }
	
	    public PokerSuit getSuit() {
	        return suit;
	    }
	}

`PokerCard` 是一个十分简单的模型类，但它足以描述游戏中的一张扑克牌。其中，number 表示扑克牌的点数，1 代表 A，11 ~ 13 代表 J ~ K；suit 表示扑克牌的花色，它是一个枚举类型；因为「德州扑克」中没有大王和小王，所以在这里不作考虑。

按照约定，如果我们需要把这个类用在使用哈希算法的集合中，就必须覆写它的 `hashCode` 和 `equals` 方法。这个容易，覆写就是了：

	@Override
    public int hashCode() {
        return Objects.hash(number, suit);
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof PokerCard)) return false;
        PokerCard other = (PokerCard) o;
        return this.number == other.number && this.suit == other.suit;
    }

另外，扑克牌之间需要比较大小，所以我们需要实现 `Comparable` 接口以支持比较操作。「德州扑克」比较牌的大小是单纯比较点数，忽略花色的，所以代码可能是这样：

	public class PokerCard implements Comparable<PokerCard> {
		// ...	

	    @Override
	    public int compareTo(PokerCard other) {
			// because 1(A) is bigger than any other number
	        int thisNum = this.number == 1 ? 14 : this.number;
	        int otherNum = other.number == 1 ? 14 : other.number;
	        return thisNum - otherNum;
	    }
	}

到此为止，一切都是那么和谐，在设计上，这个类似乎没有任何问题。
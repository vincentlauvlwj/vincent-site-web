---
layout:     post
title:      "Java Comparable 接口的一个小「坑」"
subtitle:   "关于 compareTo 和 equals 一致性的思考"
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

按照约定，如果我们需要把这个类用在基于哈希集合中，就必须覆写它的 `hashCode` 和 `equals` 方法。这个容易，覆写就是了：

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

到此为止，一切都是那么和谐，在设计上，这个类似乎没有任何问题，事实上，在大部分情况下，它也是完全可以正常工作的。

那么，现在我们需要表示一个「牌型」的概念，所谓「牌型」，在德州扑克里面，即是在玩家的手牌与桌面的公共牌中选取五张牌所组成的一个集合，在比牌时，「牌型」最大的玩家即可赢得奖池。在这个定义中，我们可以知道，「牌型」是一个集合，而且需要支持比较操作，因此我们可以让它实现 `Set` 和 `Comparable` 接口。在实际操作中，我们一般不会直接实现 `Set` 接口，而是选择继承 `AbstractSet` 类以减少代码量，因此，代码可能是这样的：

	public class PokerCombination extends AbstractSet<PokerCard> implements Comparable<PokerCard> {
	    private final SortedSet<PokerCard> cards;
	
	    public PokerCombination(Collection<PokerCard> cards) {
	        if (cards == null || cards.size() != 5) throw new IllegalArgumentException("cards");
	        this.cards = Collections.unmodifiableSortedSet(new TreeSet<>(cards));
	    }
	
	    @Override
	    public Iterator<PokerCard> iterator() {
	        return cards.iterator();
	    }
	
	    @Override
	    public int size() {
	        return cards.size();
	    }
	
	    @Override
	    public int compareTo(PokerCard o) {
	        // compare the poker combinations
	        return 0;
	    }
	}

在这里，我们省略了 `compareTo` 方法的具体代码，但是，为了方便实现比较操作， 在`PokerCombination` 类的内部实现中，采用了 `SortedSet`，这是一个有序的集合，在其中的元素都会按照其自然顺序（即 `Comparable.compareTo` 方法定义的顺序）进行排序，`TreeSet` 是它的一个常见的实现类。 

现在我们添加一个测试方法，测试这个类的行为是否正确：

	@Test
    public void testSize() {
        Set<PokerCard> cards = new HashSet<>();
        cards.add(new PokerCard(1, PokerSuit.CLUB));
        cards.add(new PokerCard(1, PokerSuit.HEART));
        cards.add(new PokerCard(2, PokerSuit.CLUB));
        cards.add(new PokerCard(3, PokerSuit.CLUB));
        cards.add(new PokerCard(4, PokerSuit.CLUB));
        assertEquals(5, cards.size());

        PokerCombination combination = new PokerCombination(cards);
        assertEquals(5, combination.size());
    }

这个测试方法非常简单，它首先创建了一个集合，往里面添加了 5 张扑克牌，断言它的长度是 5，然后用这个集合构造了一个 `PokerCombination` 对象，再断言它的长度也是 5。就这样一个简单的测试，它几乎一定会运行成功，在很多人眼里，甚至都没有写这个它的必要。

然而，当你真的运行这个测试的时候，它却失败了。这告诉我们一个道理，写程序的时候，不要想当然，要多看文档，多写测试。好了，不讲大道理，我们看看这个测试为什么失败吧，错误信息如下：

	java.lang.AssertionError: 
	Expected :5
	Actual   :4

这是一个断言错误，发生在我们的第二次 `assertEquals` 调用时，我们期望 `PokerCombination` 的长度是 5，然而它却是 4。
